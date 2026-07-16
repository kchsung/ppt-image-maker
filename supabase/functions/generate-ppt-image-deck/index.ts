import { createClient, type SupabaseClient } from 'npm:@supabase/supabase-js@2';

type SlidePlan = {
  id: string;
  pageNumber: number;
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
    styleImageDataUrl?: string;
    styleImageUrl?: string;
    selectedTemplateId?: string;
  };
  slides: SlidePlan[];
};

type GenerateSlideImageBody = {
  deckPlan?: PptDeckPlan;
  slide?: SlidePlan;
  jobId?: string;
  itemId?: string;
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
    const deckPlan = body.deckPlan;
    const slide = body.slide;
    supabaseAdmin = createOptionalAdminClient();

    const apiKey = Deno.env.get('OPENAI_API_KEY');
    if (!apiKey) {
      await markFailed(supabaseAdmin, jobId, itemId, 'OPENAI_API_KEY is not configured.');
      return json({ error: 'OPENAI_API_KEY is not configured.' }, 500);
    }

    const imageModel = Deno.env.get('OPENAI_IMAGE_MODEL') ?? 'gpt-image-2';

    if (!deckPlan || !Array.isArray(deckPlan.slides)) {
      return json({ error: 'deckPlan with slides is required.' }, 400);
    }

    if (!slide) {
      return json({ error: 'slide is required. Generate one slide per function invocation.' }, 400);
    }

    await markProcessing(supabaseAdmin, jobId, itemId);

    const prompt = buildSlideImagePrompt(deckPlan, slide);
    const referenceImage = deckPlan.request.styleImageDataUrl ?? deckPlan.request.styleImageUrl;
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
    await markFailed(supabaseAdmin, jobId, itemId, error instanceof Error ? error.message : 'Unknown error');
    return json({ error: error instanceof Error ? error.message : 'Unknown error' }, 500);
  }
});

function buildSlideImagePrompt(deckPlan: PptDeckPlan, slide: SlidePlan): string {
  return [
    slide.imagePrompt,
    '',
    'Create a polished 16:9 presentation slide image.',
    'The output must look like a finished slide, not a poster or illustration.',
    'Preserve exact labels, title, page number, and terminology.',
    'Use clean layout, readable text, and consistent footer/page-number system.',
    `Audience: ${deckPlan.request.audience}`,
    `Purpose: ${deckPlan.request.purpose}`,
    `Language: ${deckPlan.request.targetLanguage}`,
    `Page number: ${slide.pageNumber}`,
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
    throw new Error(payload?.error?.message ?? 'OpenAI image generation failed.');
  }

  const b64 = payload?.data?.[0]?.b64_json;
  if (typeof b64 !== 'string') {
    throw new Error('OpenAI response did not include image b64_json.');
  }

  return b64;
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

  await supabase
    .from('generation_jobs')
    .update({
      status: 'processing',
      updated_at: new Date().toISOString(),
    })
    .eq('id', jobId);

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

  const { count } = await supabase
    .from('generation_items')
    .select('id', { count: 'exact', head: true })
    .eq('job_id', jobId)
    .eq('status', 'succeeded');

  const { data: job } = await supabase
    .from('generation_jobs')
    .select('total_items')
    .eq('id', jobId)
    .single();

  const completedItems = count ?? 0;
  const totalItems = Number(job?.total_items ?? 0);
  const isComplete = totalItems > 0 && completedItems >= totalItems;

  await supabase
    .from('generation_jobs')
    .update({
      status: isComplete ? 'succeeded' : 'processing',
      completed_items: completedItems,
      progress: totalItems > 0 ? Math.round((completedItems / totalItems) * 100) : 0,
      updated_at: new Date().toISOString(),
    })
    .eq('id', jobId);
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

  await supabase
    .from('generation_jobs')
    .update({
      status: 'failed',
      error_message: message,
      updated_at: new Date().toISOString(),
    })
    .eq('id', jobId);

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

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      ...corsHeaders,
      'Content-Type': 'application/json',
    },
  });
}
