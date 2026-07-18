import { createClient, type SupabaseClient } from 'npm:@supabase/supabase-js@2';

type SlidePlan = {
  id: string;
  pageNumber: number;
  archetype: string;
  visualStructure: string;
  mainMessage: string;
  title: string;
  subtitle: string;
  labels: string[];
  takeaway: string;
};

type DeckPlan = {
  id: string;
  title: string;
  request: {
    targetLanguage: 'English' | 'Korean';
    audience: string;
    purpose: string;
    logoImageDataUrl?: string;
  };
  slides: SlidePlan[];
};

type SlideImage = {
  id: string;
  pageNumber: number;
  imageDataUrl?: string;
  imageUrl?: string;
};

type RequestBody = {
  deckPlan?: DeckPlan;
  imageDeck?: { generationJobId?: string; images?: SlideImage[] };
};

type ClaudeFile = { id?: string; filename?: string };

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const anthropicHeaders = (apiKey: string) => ({
  'x-api-key': apiKey,
  'anthropic-version': '2023-06-01',
  'anthropic-beta': 'skills-2025-10-02,files-api-2025-04-14',
});

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  const uploadedFileIds: string[] = [];
  try {
    const apiKey = Deno.env.get('CLAUDE_API_KEY');
    if (!apiKey) return json({ error: 'CLAUDE_API_KEY is not configured.' }, 500);

    const body = await req.json() as RequestBody;
    if (!body.deckPlan || !body.imageDeck?.images?.length) {
      return json({ error: 'deckPlan and generated slide images are required.' }, 400);
    }

    const jobId = body.imageDeck.generationJobId;
    if (!jobId) return json({ error: 'A Supabase generation job is required to save the final PPTX.' }, 400);

    const images = body.imageDeck.images.slice().sort((left, right) => left.pageNumber - right.pageNumber);
    if (images.length !== body.deckPlan.slides.length) {
      return json({ error: 'Every approved slide needs a generated reference image.' }, 400);
    }

    const uploads = await Promise.all(images.map(async (image) => {
      const file = await uploadImageFile(apiKey, image);
      uploadedFileIds.push(file.id);
      return { pageNumber: image.pageNumber, fileId: file.id, fileName: file.filename };
    }));
    const logoUpload = body.deckPlan.request.logoImageDataUrl
      ? await uploadSourceFile(apiKey, body.deckPlan.request.logoImageDataUrl, 'logo.png')
      : null;
    if (logoUpload) uploadedFileIds.push(logoUpload.id);

    const model = Deno.env.get('CLAUDE_MODEL') ?? 'claude-sonnet-5';
    const response = await createNativePresentation(apiKey, model, body.deckPlan, uploads, logoUpload);
    const pptxFileId = await findGeneratedPptxFile(apiKey, response);
    const pptxBytes = await downloadClaudeFile(apiKey, pptxFileId);
    const supabase = createAdminClient();
    const fileName = createFileName(body.deckPlan.title);
    const storagePath = `${jobId}/final/${fileName}`;

    const { error: uploadError } = await supabase.storage.from('ppt-generations').upload(storagePath, pptxBytes, {
      contentType: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      upsert: true,
    });
    if (uploadError) throw uploadError;

    const resultPath = `ppt-generations/${storagePath}`;
    const { error: updateError } = await supabase
      .from('generation_jobs')
      .update({ result_path: resultPath, error_message: null, updated_at: new Date().toISOString() })
      .eq('id', jobId);
    if (updateError) throw updateError;

    const { data } = supabase.storage.from('ppt-generations').getPublicUrl(storagePath);
    await deleteClaudeFile(apiKey, pptxFileId);
    return json({
      title: body.deckPlan.title,
      fileName,
      pptxUrl: data.publicUrl,
      resultPath,
      generationMode: 'claude-native',
      speakerNotes: body.deckPlan.slides.map((slide) => ({ pageNumber: slide.pageNumber, note: slide.mainMessage })),
      qaChecklist: [
        'Claude pptx skill rebuilt the final document from the generated slide references.',
        'Approved titles, subtitles, labels, and takeaways were recreated as native editable PowerPoint text.',
        'Complex visual assets remain raster only when native reconstruction would reduce fidelity.',
      ],
      layouts: [],
      layoutSource: 'claude',
    });
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : 'Claude native PPTX generation failed.' }, 500);
  } finally {
    if (uploadedFileIds.length > 0) {
      const apiKey = Deno.env.get('CLAUDE_API_KEY');
      if (apiKey) await Promise.all(uploadedFileIds.map((fileId) => deleteClaudeFile(apiKey, fileId)));
    }
  }
});

async function uploadImageFile(apiKey: string, image: SlideImage): Promise<{ id: string; filename: string }> {
  const source = image.imageDataUrl ?? image.imageUrl;
  if (!source) throw new Error(`Slide ${image.pageNumber} does not have an image source.`);
  return uploadSourceFile(apiKey, source, `slide-${String(image.pageNumber).padStart(2, '0')}.png`);
}

async function uploadSourceFile(apiKey: string, source: string, defaultFileName: string): Promise<{ id: string; filename: string }> {
  const { bytes, mimeType } = await readImage(source);
  const extension = mimeType === 'image/jpeg' ? 'jpg' : mimeType === 'image/webp' ? 'webp' : 'png';
  const form = new FormData();
  const fileName = defaultFileName.replace(/\.[^.]+$/u, `.${extension}`);
  form.append('file', new Blob([bytes], { type: mimeType }), fileName);
  const response = await fetch('https://api.anthropic.com/v1/files', {
    method: 'POST',
    headers: anthropicHeaders(apiKey),
    body: form,
  });
  const payload = await response.json() as ClaudeFile & { error?: { message?: string } };
  if (!response.ok || !payload.id) throw new Error(payload.error?.message ?? `Failed to upload ${defaultFileName} to Claude Files API.`);
  return { id: payload.id, filename: payload.filename ?? fileName };
}

async function createNativePresentation(
  apiKey: string,
  model: string,
  deckPlan: DeckPlan,
  uploads: Array<{ pageNumber: number; fileId: string; fileName: string }>,
  logoUpload: { id: string; filename: string } | null,
): Promise<Record<string, unknown>> {
  const content = [
    {
      type: 'text',
      text: JSON.stringify({
        task: 'Create the final native editable PowerPoint presentation.',
        requiredOutput: 'Save one finished .pptx file in the code execution container output so it can be downloaded.',
        deckPlan,
        sourceImages: uploads,
        logoAsset: logoUpload ? { fileId: logoUpload.id, fileName: logoUpload.filename, position: 'top-right' } : null,
        nonNegotiableRules: [
          'Use the pptx skill and code execution to create a real PowerPoint file, not a PDF and not a deck made of full-slide screenshots.',
          'Inspect each attached source image as the visual reference for its matching page.',
          'Use the approved deckPlan copy exactly. Do not trust OCR wording when it differs from the approved title, subtitle, labels, or takeaway.',
          'Recreate every approved title, subtitle, label, takeaway, and logo placeholder as native editable PowerPoint text using Pretendard or a compatible sans-serif fallback.',
          'Use the source image to identify the intended text positions, hierarchy, color treatment, and blank or flat surfaces. Align native text to those observed regions.',
          'Do not place a full-slide source image behind duplicated native text. Preserve only complex illustrations, decorative textures, or diagrams as cropped raster assets when necessary.',
          'When a simple visual can be recreated with native PowerPoint shapes, recreate it natively. Keep complex artwork as an image asset rather than degrading it.',
          'Respect each slide visualStructure and keep the deck varied: do not collapse comparison, process, roadmap, hub, dashboard, and case slides into the same card layout.',
          'Keep text readable, unclipped, and non-overlapping. Use the requested target language consistently.',
          `Place a provided logo asset in the top-right. When no logo asset was provided, leave an editable ${deckPlan.request.targetLanguage === 'Korean' ? '\"로고\"' : '\"Logo\"'} placeholder there.`,
          'Add one final editable manual template slide that matches the deck style and provides title, subtitle, labels, takeaway, logo placeholder, and a visual placeholder.',
        ],
      }),
    },
    ...uploads.flatMap((upload) => [
      { type: 'image', source: { type: 'file', file_id: upload.fileId } },
      { type: 'container_upload', file_id: upload.fileId },
    ]),
    ...(logoUpload ? [
      { type: 'image', source: { type: 'file', file_id: logoUpload.id } },
      { type: 'container_upload', file_id: logoUpload.id },
    ] : []),
  ];
  const firstRequest = {
    model,
    max_tokens: 16000,
    container: { skills: [{ type: 'anthropic', skill_id: 'pptx', version: 'latest' }] },
    tools: [{ type: 'code_execution_20260521', name: 'code_execution' }],
    messages: [{ role: 'user', content }],
  };
  let payload = await sendClaudeMessage(apiKey, firstRequest);

  for (let resumeCount = 0; payload.stop_reason === 'pause_turn' && resumeCount < 2; resumeCount += 1) {
    const containerId = getContainerId(payload);
    const assistantContent = payload.content;
    if (!containerId || !Array.isArray(assistantContent)) {
      throw new Error('Claude paused PPTX generation without a reusable container response.');
    }

    payload = await sendClaudeMessage(apiKey, {
      model,
      max_tokens: 16000,
      container: { id: containerId },
      tools: [{ type: 'code_execution_20260521', name: 'code_execution' }],
      messages: [
        { role: 'user', content },
        { role: 'assistant', content: assistantContent },
        { role: 'user', content: 'Continue the same PPTX task. Finish the editable .pptx file and save it to the container output.' },
      ],
    });
  }

  if (payload.stop_reason === 'pause_turn') {
    throw new Error('Claude PPTX generation exceeded the continuation limit. Retry the PPT generation.');
  }
  return payload;
}

async function sendClaudeMessage(apiKey: string, body: Record<string, unknown>): Promise<Record<string, unknown>> {
  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { ...anthropicHeaders(apiKey), 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const payload = await response.json() as Record<string, unknown> & { error?: { message?: string } };
  if (!response.ok) throw new Error(payload.error?.message ?? 'Claude pptx skill request failed.');
  return payload;
}

function getContainerId(response: Record<string, unknown>): string | null {
  return isRecord(response.container) && typeof response.container.id === 'string' ? response.container.id : null;
}

async function findGeneratedPptxFile(apiKey: string, response: Record<string, unknown>): Promise<string> {
  const fileIds = collectFileIds(response);
  if (fileIds.length === 0) throw new Error('Claude pptx skill did not return a generated file.');
  const files = await Promise.all(fileIds.map(async (fileId) => ({ fileId, metadata: await getClaudeFileMetadata(apiKey, fileId) })));
  return files.find(({ metadata }) => metadata.filename?.toLowerCase().endsWith('.pptx'))?.fileId ?? files.at(-1)!.fileId;
}

function collectFileIds(response: Record<string, unknown>): string[] {
  const content = Array.isArray(response.content) ? response.content : [];
  const ids = content.flatMap((block) => {
    if (!isRecord(block) || block.type !== 'bash_code_execution_tool_result' || !isRecord(block.content)) return [];
    const outputs = Array.isArray(block.content.content) ? block.content.content : [];
    return outputs.flatMap((output) => isRecord(output) && typeof output.file_id === 'string' ? [output.file_id] : []);
  });
  return Array.from(new Set(ids));
}

async function getClaudeFileMetadata(apiKey: string, fileId: string): Promise<ClaudeFile> {
  const response = await fetch(`https://api.anthropic.com/v1/files/${fileId}`, { headers: anthropicHeaders(apiKey) });
  const payload = await response.json() as ClaudeFile & { error?: { message?: string } };
  if (!response.ok) throw new Error(payload.error?.message ?? `Unable to read Claude output file ${fileId}.`);
  return payload;
}

async function downloadClaudeFile(apiKey: string, fileId: string): Promise<Uint8Array> {
  const response = await fetch(`https://api.anthropic.com/v1/files/${fileId}/content`, { headers: anthropicHeaders(apiKey) });
  if (!response.ok) throw new Error(`Unable to download Claude PPTX output (${response.status}).`);
  return new Uint8Array(await response.arrayBuffer());
}

async function deleteClaudeFile(apiKey: string, fileId: string): Promise<void> {
  await fetch(`https://api.anthropic.com/v1/files/${fileId}`, { method: 'DELETE', headers: anthropicHeaders(apiKey) });
}

async function readImage(source: string): Promise<{ bytes: Uint8Array; mimeType: string }> {
  if (source.startsWith('data:')) {
    const match = source.match(/^data:(image\/(?:png|jpeg|webp));base64,(.+)$/u);
    if (!match) throw new Error('Generated image data URL is invalid.');
    return { bytes: base64ToBytes(match[2]), mimeType: match[1] };
  }
  const response = await fetch(source);
  if (!response.ok) throw new Error(`Unable to load generated slide image (${response.status}).`);
  return { bytes: new Uint8Array(await response.arrayBuffer()), mimeType: response.headers.get('content-type') ?? 'image/png' };
}

function createAdminClient(): SupabaseClient {
  const url = Deno.env.get('SUPABASE_URL');
  const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!url || !key) throw new Error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required.');
  return createClient(url, key);
}

function createFileName(title: string): string {
  const cleaned = title.replace(/[\\/:*?"<>|]+/g, '-').replace(/\s+/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');
  return `${cleaned || 'qlearn-editable-deck'}.pptx`;
}

function base64ToBytes(value: string): Uint8Array {
  const binary = atob(value);
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
}
