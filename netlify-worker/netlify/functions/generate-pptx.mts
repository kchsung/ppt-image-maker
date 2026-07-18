import type { Config } from '@netlify/functions';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

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

type WorkerRequest = {
  deckPlan?: DeckPlan;
  imageDeck?: { generationJobId?: string; images?: SlideImage[] };
  executionId?: string;
};

type ClaudeFile = { id?: string; filename?: string };

const PPTX_CONTENT_TYPE = 'application/vnd.openxmlformats-officedocument.presentationml.presentation';

export default async (request: Request): Promise<Response> => {
  const secret = process.env.PPT_WORKER_SECRET;
  if (!secret || request.headers.get('x-ppt-worker-secret') !== secret) {
    return Response.json({ error: 'Unauthorized worker request.' }, { status: 401 });
  }

  let jobId: string | undefined;
  let executionId: string | undefined;
  let supabase: SupabaseClient | null = null;

  try {
    const body = await request.json() as WorkerRequest;
    if (!body.deckPlan || !body.imageDeck?.generationJobId || !body.imageDeck.images?.length || !body.executionId) {
      return Response.json({ error: 'deckPlan, generated slide images, and an execution ID are required.' }, { status: 400 });
    }

    jobId = body.imageDeck.generationJobId;
    executionId = body.executionId;
    supabase = createAdminClient();
    const apiKey = requiredEnv('CLAUDE_API_KEY');
    logEvent('pptx.worker.started', { jobId, executionId: body.executionId, slideCount: body.imageDeck.images.length });

    const existingJob = await getExistingJob(supabase, jobId);
    if (existingJob.result_path) {
      await updateStatus(supabase, jobId, 'succeeded', null, 100, 'Ready to preview and download', body.executionId);
      logEvent('pptx.worker.skipped_existing_output', { jobId, executionId: body.executionId });
      return Response.json({ ok: true });
    }

    await generateNativePptx(apiKey, body.deckPlan, body.imageDeck.images, jobId, body.executionId, supabase);
    await updateStatus(supabase, jobId, 'succeeded', null, 100, 'Ready to preview and download', body.executionId);
    logEvent('pptx.worker.completed', { jobId, executionId: body.executionId });
    return Response.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Native PPTX worker failed.';
    console.error(JSON.stringify({ event: 'pptx.worker.failed', jobId: jobId ?? null, error: message }));
    if (supabase && jobId) {
      if (executionId) {
        await updateStatus(supabase, jobId, 'failed', message, 0, 'PPTX generation failed', executionId);
      }
    }
    throw error;
  }
};

export const config: Config = {
  background: true,
  path: '/pptx-worker',
};

async function generateNativePptx(
  apiKey: string,
  deckPlan: DeckPlan,
  slideImages: SlideImage[],
  jobId: string,
  executionId: string,
  supabase: SupabaseClient,
): Promise<void> {
  const uploadedFileIds: string[] = [];
  try {
    const images = slideImages.slice().sort((left, right) => left.pageNumber - right.pageNumber);
    if (images.length !== deckPlan.slides.length) {
      throw new Error('Every approved slide needs a generated reference image.');
    }

    await updateStatus(supabase, jobId, 'processing', null, 15, 'Uploading slide references to Claude', executionId);
    const uploads = await Promise.all(images.map(async (image) => {
      const file = await uploadSourceFile(apiKey, image.imageDataUrl ?? image.imageUrl, `slide-${String(image.pageNumber).padStart(2, '0')}.png`);
      uploadedFileIds.push(file.id);
      return { pageNumber: image.pageNumber, fileId: file.id, fileName: file.filename };
    }));
    const logoUpload = deckPlan.request.logoImageDataUrl
      ? await uploadSourceFile(apiKey, deckPlan.request.logoImageDataUrl, 'logo.png')
      : null;
    if (logoUpload) uploadedFileIds.push(logoUpload.id);

    await updateStatus(supabase, jobId, 'processing', null, 35, 'Claude is rebuilding editable slides', executionId);
    const response = await createNativePresentation(apiKey, deckPlan, uploads, logoUpload);
    const pptxFileId = await findGeneratedPptxFile(apiKey, response);

    await updateStatus(supabase, jobId, 'processing', null, 80, 'Downloading the generated PPTX', executionId);
    const pptxBytes = await downloadClaudeFile(apiKey, pptxFileId);
    const fileName = createFileName(deckPlan.title);
    const storagePath = `${jobId}/final/${fileName}`;

    await updateStatus(supabase, jobId, 'processing', null, 92, 'Saving the PPTX to Supabase Storage', executionId);
    const { error: uploadError } = await supabase.storage.from('ppt-generations').upload(storagePath, pptxBytes, {
      contentType: PPTX_CONTENT_TYPE,
      upsert: true,
    });
    if (uploadError) throw uploadError;

    const { error: updateError } = await supabase
      .from('generation_jobs')
      .update({ result_path: `ppt-generations/${storagePath}`, error_message: null, updated_at: new Date().toISOString() })
      .eq('id', jobId);
    if (updateError) throw updateError;
  } finally {
    await Promise.all(uploadedFileIds.map((fileId) => deleteClaudeFile(apiKey, fileId)));
  }
}

async function createNativePresentation(
  apiKey: string,
  deckPlan: DeckPlan,
  uploads: Array<{ pageNumber: number; fileId: string; fileName: string }>,
  logoUpload: { id: string; filename: string } | null,
): Promise<Record<string, unknown>> {
  const model = process.env.CLAUDE_MODEL || 'claude-sonnet-5';
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
          'Use the pptx skill and code execution to create a real PowerPoint file, not a deck made of full-slide screenshots.',
          'Inspect each source image and use the approved deckPlan copy exactly.',
          'Recreate approved titles, subtitles, labels, takeaways, and logo placeholder as native editable text using Pretendard or a compatible sans-serif fallback.',
          'Use the source image to match text position, hierarchy, color treatment, and blank surfaces. Keep only complex illustrations as raster assets.',
          'Respect each visualStructure so comparison, process, roadmap, hub, dashboard, and closing slides remain distinct.',
          'Keep text readable, unclipped, non-overlapping, and in the requested language.',
          'Place the provided logo at top-right, or leave an editable Logo placeholder when there is no logo.',
          'Add one final editable manual template slide matching the deck style.',
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

  let payload = await sendClaudeMessage(apiKey, {
    model,
    max_tokens: 16000,
    container: { skills: [{ type: 'anthropic', skill_id: 'pptx', version: 'latest' }] },
    tools: [{ type: 'code_execution_20260521', name: 'code_execution' }],
    messages: [{ role: 'user', content }],
  });

  for (let resumeCount = 0; payload.stop_reason === 'pause_turn' && resumeCount < 4; resumeCount += 1) {
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
        { role: 'user', content: 'Continue the same PPTX task. Finish and save the editable .pptx file to the container output.' },
      ],
    });
  }
  if (payload.stop_reason === 'pause_turn') {
    throw new Error('Claude PPTX generation exceeded the continuation limit. Retry the PPTX generation.');
  }
  return payload;
}

async function uploadSourceFile(apiKey: string, source: string | undefined, defaultFileName: string): Promise<{ id: string; filename: string }> {
  if (!source) throw new Error(`${defaultFileName} is missing.`);
  const { bytes, mimeType } = await readImage(source);
  const extension = mimeType === 'image/jpeg' ? 'jpg' : mimeType === 'image/webp' ? 'webp' : 'png';
  const form = new FormData();
  const fileName = defaultFileName.replace(/\.[^.]+$/u, `.${extension}`);
  const blobBytes = new Uint8Array(bytes.byteLength);
  blobBytes.set(bytes);
  form.append('file', new Blob([blobBytes.buffer], { type: mimeType }), fileName);
  const response = await fetch('https://api.anthropic.com/v1/files', {
    method: 'POST', headers: anthropicHeaders(apiKey), body: form,
  });
  const payload = await response.json() as ClaudeFile & { error?: { message?: string } };
  if (!response.ok || !payload.id) throw new Error(payload.error?.message ?? `Failed to upload ${defaultFileName} to Claude Files API.`);
  return { id: payload.id, filename: payload.filename ?? fileName };
}

async function sendClaudeMessage(apiKey: string, body: Record<string, unknown>): Promise<Record<string, unknown>> {
  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST', headers: { ...anthropicHeaders(apiKey), 'Content-Type': 'application/json' }, body: JSON.stringify(body),
  });
  const payload = await response.json() as Record<string, unknown> & { error?: { message?: string } };
  if (!response.ok) throw new Error(payload.error?.message ?? 'Claude pptx skill request failed.');
  return payload;
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
    if (!match) throw new Error('Image data URL is invalid.');
    return { bytes: Uint8Array.from(Buffer.from(match[2], 'base64')), mimeType: match[1] };
  }
  const response = await fetch(source);
  if (!response.ok) throw new Error(`Unable to load generated slide image (${response.status}).`);
  return { bytes: new Uint8Array(await response.arrayBuffer()), mimeType: response.headers.get('content-type') ?? 'image/png' };
}

async function updateStatus(
  supabase: SupabaseClient,
  jobId: string,
  status: 'processing' | 'succeeded' | 'failed',
  errorMessage: string | null,
  progress: number,
  phase: string,
  executionId: string,
): Promise<void> {
  const job = await getExistingJob(supabase, jobId);
  const request = isRecord(job.request) ? job.request : {};
  const { error } = await supabase.from('generation_jobs').update({
    request: {
      ...request,
      pptxGeneration: {
        status,
        errorMessage,
        progress,
        phase,
        executor: 'netlify-worker',
        executionId,
        updatedAt: new Date().toISOString(),
      },
    },
    updated_at: new Date().toISOString(),
  }).eq('id', jobId);
  if (error) throw error;
}

async function getExistingJob(supabase: SupabaseClient, jobId: string): Promise<{ request: unknown; result_path: string | null }> {
  const { data, error } = await supabase.from('generation_jobs').select('request,result_path').eq('id', jobId).single();
  if (error || !data) throw error ?? new Error('PPT generation job was not found.');
  return data;
}

function createAdminClient(): SupabaseClient {
  return createClient(requiredEnv('SUPABASE_URL'), requiredEnv('SUPABASE_SERVICE_ROLE_KEY'));
}

function requiredEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is not configured.`);
  return value;
}

function anthropicHeaders(apiKey: string): Record<string, string> {
  return {
    'x-api-key': apiKey,
    'anthropic-version': '2023-06-01',
    'anthropic-beta': 'skills-2025-10-02,files-api-2025-04-14',
  };
}

function getContainerId(response: Record<string, unknown>): string | null {
  return isRecord(response.container) && typeof response.container.id === 'string' ? response.container.id : null;
}

function createFileName(title: string): string {
  const cleaned = title.replace(/[\\/:*?"<>|]+/g, '-').replace(/\s+/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');
  return `${cleaned || 'qlearn-editable-deck'}.pptx`;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function logEvent(event: string, details: Record<string, string | number>): void {
  console.info(JSON.stringify({ event, ...details }));
}
