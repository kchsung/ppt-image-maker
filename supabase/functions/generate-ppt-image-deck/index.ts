import { createClient, type SupabaseClient } from 'npm:@supabase/supabase-js@2';

type SlidePlan = {
  id: string;
  pageNumber: number;
  archetype: string;
  visualStructure: string;
  title: string;
  subtitle: string;
  mainMessage: string;
  labels: string[];
  takeaway: string;
  imagePrompt: string;
};

type PptDeckPlan = {
  id: string;
  title: string;
  request: {
    targetLanguage: 'English' | 'Korean';
    audience: string;
    purpose: string;
    styleReference: {
      notes: string;
      primaryColorLabel: string;
      accentColorLabel: string;
    };
    styleImageDataUrl?: string;
    styleImageUrl?: string;
    selectedTemplateId?: string;
    logoImageDataUrl?: string;
  };
  slides: SlidePlan[];
};

type GenerateSlideImageBody = {
  deckPlan?: PptDeckPlan;
  slide?: SlidePlan;
  jobId?: string;
  itemId?: string;
};

type JobRequestRow = {
  request: {
    deckPlan?: PptDeckPlan;
  } | null;
};

type GenerationItemRow = {
  id: string;
  item_index: number;
  input: {
    slideId?: string;
    pageNumber?: number;
  } | null;
};

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return json({ error: 'Method not allowed' }, 405);
  }

  let supabaseAdmin: SupabaseClient | null = null;
  let jobId: string | undefined;
  let itemId: string | undefined;

  try {
    const body = (await req.json()) as GenerateSlideImageBody;
    jobId = body.jobId;
    itemId = body.itemId;
    supabaseAdmin = createOptionalAdminClient();
    const { deckPlan, slide } = await resolveGenerationInput(supabaseAdmin, body);

    const apiKey = Deno.env.get('OPENAI_API_KEY');
    if (!apiKey) {
      await markFailed(supabaseAdmin, jobId, itemId, 'OPENAI_API_KEY is not configured.');
      return json({ error: 'OPENAI_API_KEY is not configured.' }, 500);
    }

    const imageModel = Deno.env.get('OPENAI_IMAGE_MODEL') ?? 'gpt-image-2';

    await markProcessing(supabaseAdmin, jobId, itemId);

    const prompt = buildSlideImagePrompt(deckPlan, slide);
    const referenceImage = deckPlan.request.styleImageDataUrl;
    const b64 = referenceImage
      ? await editImageFromReference(apiKey, imageModel, prompt, referenceImage)
      : await generateImage(apiKey, imageModel, prompt);
    const storageResult = await uploadGeneratedImage(supabaseAdmin, jobId, slide, b64);

    await markSucceeded(supabaseAdmin, jobId, itemId, storageResult?.path);

    return json({
      id: `image-${slide.id}`,
      slideId: slide.id,
      pageNumber: slide.pageNumber,
      title: slide.title,
      imageDataUrl: storageResult ? undefined : `data:image/png;base64,${b64}`,
      imageUrl: storageResult?.publicUrl,
      storagePath: storageResult?.path,
      generationItemId: itemId,
      prompt,
      provider: 'openai',
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    await markFailed(supabaseAdmin, jobId, itemId, message);
    if (error instanceof OpenAiImageRateLimitError) {
      return json(
        { error: message, retryAfterSeconds: error.retryAfterSeconds },
        429,
        { 'Retry-After': String(error.retryAfterSeconds) },
      );
    }
    return json({ error: message }, 500);
  }
});

async function resolveGenerationInput(
  supabase: SupabaseClient | null,
  body: GenerateSlideImageBody,
): Promise<{ deckPlan: PptDeckPlan; slide: SlidePlan }> {
  if (body.deckPlan && Array.isArray(body.deckPlan.slides) && body.slide) {
    return { deckPlan: body.deckPlan, slide: body.slide };
  }

  if (!supabase || !body.jobId || !body.itemId) {
    throw new Error('deckPlan and slide are required unless jobId and itemId are provided.');
  }

  const { data: job, error: jobError } = await supabase
    .from('generation_jobs')
    .select('request')
    .eq('id', body.jobId)
    .single();

  if (jobError || !job) {
    throw jobError ?? new Error('Generation job was not found.');
  }

  const { data: item, error: itemError } = await supabase
    .from('generation_items')
    .select('id,item_index,input')
    .eq('id', body.itemId)
    .eq('job_id', body.jobId)
    .single();

  if (itemError || !item) {
    throw itemError ?? new Error('Generation item was not found.');
  }

  const deckPlan = ((job as JobRequestRow).request?.deckPlan ?? null) as PptDeckPlan | null;
  if (!deckPlan || !Array.isArray(deckPlan.slides)) {
    throw new Error('Generation job does not include a valid deckPlan.');
  }

  const generationItem = item as GenerationItemRow;
  const pageNumber = generationItem.input?.pageNumber ?? generationItem.item_index;
  const slideId = generationItem.input?.slideId;
  const slide =
    deckPlan.slides.find((candidate) => candidate.id === slideId) ??
    deckPlan.slides.find((candidate) => candidate.pageNumber === pageNumber);

  if (!slide) {
    throw new Error(`Slide plan for item ${body.itemId} was not found.`);
  }

  return { deckPlan, slide };
}

function buildSlideImagePrompt(deckPlan: PptDeckPlan, slide: SlidePlan): string {
  return [
    slide.imagePrompt,
    '',
    'Create a polished 16:9 presentation reference slide with the approved copy visible.',
    'The final PPTX will be rebuilt by Claude from this image, so use the exact approved title, subtitle, labels, and takeaway that were provided above.',
    'Do not repeat the selected template layout. Apply its palette, typography mood, icon language, and footer treatment to this slide-specific composition only.',
    'Place copy on simple, high-contrast background regions and avoid text over complex illustrations so Claude can separate visual assets from editable text.',
    'Do not invent or render a brand logo. Reserve a clean logo area in the top-right corner without any text.',
    deckPlan.request.logoImageDataUrl
      ? 'A real logo was uploaded and will be inserted later in PowerPoint at the top-right, so keep that corner clean.'
      : 'No logo was uploaded. Keep the top-right logo area clean and empty; PowerPoint will add its editable logo placeholder there.',
    'Typography style should resemble Pretendard: modern, clean, readable Korean/English sans-serif.',
    `Audience: ${deckPlan.request.audience}`,
    `Purpose: ${deckPlan.request.purpose}`,
    `Language context: ${deckPlan.request.targetLanguage}`,
    `Slide concept: ${slide.mainMessage}`,
    `Story role: ${slide.archetype}. Required visual structure: ${slide.visualStructure}.`,
    'Preserve the required visual structure instead of reusing the previous slide layout.',
  ].join('\n');
}

async function generateImage(apiKey: string, model: string, prompt: string): Promise<string> {
  const response = await fetch('https://api.openai.com/v1/images/generations', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model,
      prompt,
      size: '1536x1024',
      quality: 'medium',
      output_format: 'png',
    }),
  });

  return readImageB64(response);
}

async function editImageFromReference(
  apiKey: string,
  model: string,
  prompt: string,
  referenceImage: string,
): Promise<string> {
  const { bytes, mimeType } = await loadReferenceImage(referenceImage);
  const form = new FormData();
  form.append('model', model);
  form.append('prompt', prompt);
  form.append('size', '1536x1024');
  form.append('quality', 'medium');
  form.append('output_format', 'png');
  form.append('image', new Blob([bytes], { type: mimeType }), `style-reference.${mimeType.split('/')[1] ?? 'png'}`);

  const response = await fetch('https://api.openai.com/v1/images/edits', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
    },
    body: form,
  });

  return readImageB64(response);
}

async function readImageB64(response: Response): Promise<string> {
  const payload = await response.json();
  if (!response.ok) {
    if (response.status === 429) {
      throw new OpenAiImageRateLimitError(getRetryAfterSeconds(response, payload));
    }
    throw new Error(payload?.error?.message ?? 'OpenAI image generation failed.');
  }

  const b64 = payload?.data?.[0]?.b64_json;
  if (typeof b64 !== 'string') {
    throw new Error('OpenAI response did not include image b64_json.');
  }

  return b64;
}

class OpenAiImageRateLimitError extends Error {
  constructor(readonly retryAfterSeconds: number) {
    super(`OpenAI image rate limit reached. Retry after ${retryAfterSeconds} seconds.`);
    this.name = 'OpenAiImageRateLimitError';
  }
}

function getRetryAfterSeconds(response: Response, payload: unknown): number {
  const headerSeconds = Number(response.headers.get('retry-after'));
  if (Number.isFinite(headerSeconds) && headerSeconds > 0) return Math.ceil(headerSeconds);
  const message = isRecord(payload) && isRecord(payload.error) && typeof payload.error.message === 'string'
    ? payload.error.message
    : '';
  const match = message.match(/try again in\s+(\d+)s/iu);
  return match ? Math.max(1, Number(match[1])) : 15;
}

async function loadReferenceImage(reference: string): Promise<{ bytes: Uint8Array; mimeType: string }> {
  if (reference.startsWith('data:')) {
    return decodeDataUrl(reference);
  }

  const response = await fetch(reference);
  if (!response.ok) {
    throw new Error(`Failed to load template image: ${response.status}`);
  }

  return {
    bytes: new Uint8Array(await response.arrayBuffer()),
    mimeType: response.headers.get('content-type') ?? 'image/png',
  };
}

function decodeDataUrl(dataUrl: string): { bytes: Uint8Array; mimeType: string } {
  const match = dataUrl.match(/^data:(.*?);base64,(.*)$/);
  if (!match) {
    throw new Error('styleImageDataUrl must be a base64 data URL.');
  }

  const binary = atob(match[2]);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }

  return { bytes, mimeType: match[1] || 'image/png' };
}

function createOptionalAdminClient(): SupabaseClient | null {
  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

  if (!supabaseUrl || !serviceRoleKey) {
    return null;
  }

  return createClient(supabaseUrl, serviceRoleKey);
}

async function markProcessing(supabase: SupabaseClient | null, jobId?: string, itemId?: string): Promise<void> {
  if (!supabase || !jobId) {
    return;
  }

  if (!itemId) {
    return;
  }

  await supabase
    .from('generation_items')
    .update({
      status: 'processing',
      attempts: 1,
      error_message: null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', itemId);

  await refreshJobStatus(supabase, jobId);
}

async function markSucceeded(
  supabase: SupabaseClient | null,
  jobId?: string,
  itemId?: string,
  outputPath?: string,
): Promise<void> {
  if (!supabase || !jobId) {
    return;
  }

  if (itemId) {
    await supabase
      .from('generation_items')
      .update({
        status: 'succeeded',
        output_path: outputPath,
        error_message: null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', itemId);
  }

  await refreshJobStatus(supabase, jobId);
}

async function markFailed(
  supabase: SupabaseClient | null,
  jobId: string | undefined,
  itemId: string | undefined,
  message: string,
): Promise<void> {
  if (!supabase || !jobId) {
    return;
  }

  if (!itemId) {
    return;
  }

  await supabase
    .from('generation_items')
    .update({
      status: 'failed',
      error_message: message,
      updated_at: new Date().toISOString(),
    })
    .eq('id', itemId);

  await refreshJobStatus(supabase, jobId);
}

async function refreshJobStatus(supabase: SupabaseClient, jobId: string): Promise<void> {
  const { error } = await supabase.rpc('refresh_ppt_generation_job_status', { p_job_id: jobId });
  if (error) {
    throw error;
  }
}

async function uploadGeneratedImage(
  supabase: SupabaseClient | null,
  jobId: string | undefined,
  slide: SlidePlan,
  b64: string,
): Promise<{ path: string; publicUrl: string } | null> {
  if (!supabase || !jobId) {
    return null;
  }

  const path = `${jobId}/slide-${String(slide.pageNumber).padStart(2, '0')}.png`;
  const { error } = await supabase.storage
    .from('ppt-generations')
    .upload(path, base64ToBytes(b64), {
      contentType: 'image/png',
      upsert: true,
    });

  if (error) {
    throw error;
  }

  const { data } = supabase.storage.from('ppt-generations').getPublicUrl(path);
  return { path: `ppt-generations/${path}`, publicUrl: data.publicUrl };
}

function base64ToBytes(b64: string): Uint8Array {
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }

  return bytes;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function json(data: unknown, status = 200, extraHeaders: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      ...corsHeaders,
      ...extraHeaders,
      'Content-Type': 'application/json',
    },
  });
}
