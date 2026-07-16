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

  try {
    const apiKey = Deno.env.get('OPENAI_API_KEY');
    if (!apiKey) {
      return json({ error: 'OPENAI_API_KEY is not configured.' }, 500);
    }

    const imageModel = Deno.env.get('OPENAI_IMAGE_MODEL') ?? 'gpt-image-2';
    const body = (await req.json()) as { deckPlan?: PptDeckPlan };
    const deckPlan = body.deckPlan;

    if (!deckPlan || !Array.isArray(deckPlan.slides)) {
      return json({ error: 'deckPlan with slides is required.' }, 400);
    }

    const images = [];
    for (const slide of deckPlan.slides) {
      const prompt = buildSlideImagePrompt(deckPlan, slide);
      const referenceImage = deckPlan.request.styleImageDataUrl ?? deckPlan.request.styleImageUrl;
      const b64 = referenceImage
        ? await editImageFromReference(apiKey, imageModel, prompt, referenceImage)
        : await generateImage(apiKey, imageModel, prompt);

      images.push({
        id: `image-${slide.id}`,
        slideId: slide.id,
        pageNumber: slide.pageNumber,
        title: slide.title,
        imageDataUrl: `data:image/png;base64,${b64}`,
        prompt,
        provider: 'openai',
      });
    }

    return json({
      id: `image-deck-${Date.now()}`,
      deckPlanId: deckPlan.id,
      createdAt: new Date().toISOString(),
      images,
    });
  } catch (error) {
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

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      ...corsHeaders,
      'Content-Type': 'application/json',
    },
  });
}
