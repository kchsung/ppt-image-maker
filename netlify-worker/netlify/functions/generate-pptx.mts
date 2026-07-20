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
// Keep each Claude request below the upstream connection window. A complete
// deck is rebuilt in small batches while the same Claude container persists.
const CLAUDE_MESSAGE_TIMEOUT_MS = 4 * 60 * 1_000;
const SLIDES_PER_CLAUDE_REQUEST = 2;
const CLAUDE_NETWORK_RETRY_COUNT = 2;
const STATUS_HEARTBEAT_INTERVAL_MS = 60 * 1_000;

export async function runPptxWorker(request: Request): Promise<Response> {
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
    if (supabase && jobId && executionId) {
      try {
        await updateStatus(supabase, jobId, 'failed', message, 0, 'PPTX generation failed', executionId);
      } catch (statusError) {
        console.error(JSON.stringify({
          event: 'pptx.worker.failure_status_update_failed',
          jobId,
          executionId,
          error: statusError instanceof Error ? statusError.message : 'Unable to persist the failure status.',
        }));
      }
    }
    throw error;
  }
}

export default runPptxWorker;

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

    await updateStatus(supabase, jobId, 'processing', null, 35, 'Claude is rebuilding editable slides in small batches', executionId);
    logEvent('pptx.worker.claude_rebuild_started', { jobId, executionId });
    const heartbeat = setInterval(() => {
      void updateStatus(supabase, jobId, 'processing', null, 35, 'Claude is rebuilding editable slides in small batches', executionId)
        .then(() => logEvent('pptx.worker.claude_rebuild_heartbeat', { jobId, executionId }))
        .catch((error: unknown) => {
          console.error(JSON.stringify({
            event: 'pptx.worker.heartbeat_failed',
            jobId,
            executionId,
            error: error instanceof Error ? error.message : 'Unable to update PPTX progress.',
          }));
        });
    }, STATUS_HEARTBEAT_INTERVAL_MS);

    let response: Record<string, unknown>;
    try {
      response = await createNativePresentation(apiKey, deckPlan, uploads, logoUpload, async (completedBatches, totalBatches) => {
        const progress = 35 + Math.round((completedBatches / totalBatches) * 40);
        await updateStatus(
          supabase,
          jobId,
          'processing',
          null,
          progress,
          `Claude rebuilt batch ${completedBatches} of ${totalBatches}`,
          executionId,
        );
      });
    } finally {
      clearInterval(heartbeat);
    }
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
    const cleanup = await Promise.allSettled(uploadedFileIds.map((fileId) => deleteClaudeFile(apiKey, fileId)));
    cleanup.forEach((result) => {
      if (result.status === 'rejected') {
        console.warn(JSON.stringify({
          event: 'pptx.worker.claude_file_cleanup_failed',
          jobId,
          error: result.reason instanceof Error ? result.reason.message : 'Unable to delete a Claude source file.',
        }));
      }
    });
  }
}

async function createNativePresentation(
  apiKey: string,
  deckPlan: DeckPlan,
  uploads: Array<{ pageNumber: number; fileId: string; fileName: string }>,
  logoUpload: { id: string; filename: string } | null,
  onBatchComplete: (completedBatches: number, totalBatches: number) => Promise<void>,
): Promise<Record<string, unknown>> {
  const model = process.env.CLAUDE_MODEL || 'claude-sonnet-5';
  const batches = chunk(uploads, SLIDES_PER_CLAUDE_REQUEST);
  let containerId: string | null = null;
  let payload: Record<string, unknown> | null = null;

  for (const [batchIndex, batch] of batches.entries()) {
    const isFirstBatch = batchIndex === 0;
    const isFinalBatch = batchIndex === batches.length - 1;
    const batchSlides = batch.map((upload) => {
      const slide = deckPlan.slides.find((candidate) => candidate.pageNumber === upload.pageNumber);
      if (!slide) throw new Error(`Approved copy is missing for slide ${upload.pageNumber}.`);
      return { ...slide, sourceImage: upload };
    });
    const content = [
      {
        type: 'text',
        text: JSON.stringify({
          task: isFirstBatch
            ? 'Create the first batch of a final native editable PowerPoint presentation.'
            : 'Continue the existing PowerPoint file in the container and add the next slide batch.',
          batch: `${batchIndex + 1} of ${batches.length}`,
          outputFile: 'qlearn-editable-deck.pptx',
          presentation: { title: deckPlan.title, request: deckPlan.request },
          slidesToBuild: batchSlides,
          logoAsset: isFirstBatch && logoUpload
            ? { fileId: logoUpload.id, fileName: logoUpload.filename, position: 'top-right' }
            : null,
          finalBatch: isFinalBatch,
          nonNegotiableRules: [
            'Use the pptx skill and code execution to create or update qlearn-editable-deck.pptx as a real PowerPoint file, never as full-slide screenshots.',
            'Inspect each supplied source image and reproduce the approved slide copy as native editable text using Pretendard or a compatible sans-serif fallback.',
            'Match text position, hierarchy, color treatment, and blank surfaces from each source image. Keep only complex illustrations as raster assets.',
            'Respect each visualStructure so slide compositions remain distinct. Keep text readable, unclipped, non-overlapping, and in the requested language.',
            'Place the provided logo at top-right, or leave an editable Logo placeholder when no logo is supplied.',
            ...(isFinalBatch ? ['Add one final editable manual template slide matching the deck style, then attach qlearn-editable-deck.pptx as a code execution output file.'] : ['Save qlearn-editable-deck.pptx before responding so the next batch can continue it.']),
          ],
        }),
      },
      ...batch.flatMap((upload) => [
        { type: 'image', source: { type: 'file', file_id: upload.fileId } },
        { type: 'container_upload', file_id: upload.fileId },
      ]),
      ...(isFirstBatch && logoUpload ? [
        { type: 'image', source: { type: 'file', file_id: logoUpload.id } },
        { type: 'container_upload', file_id: logoUpload.id },
      ] : []),
    ];

    payload = await completeClaudeBatch(apiKey, {
      model,
      max_tokens: 16000,
      container: containerId
        ? { id: containerId }
        : { skills: [{ type: 'anthropic', skill_id: 'pptx', version: 'latest' }] },
      tools: [{ type: 'code_execution_20260521', name: 'code_execution' }],
      messages: [{ role: 'user', content }],
    }, batchIndex + 1, batches.length);
    containerId = getContainerId(payload);
    if (!containerId) throw new Error(`Claude did not preserve a reusable container after PPTX batch ${batchIndex + 1}.`);
    await onBatchComplete(batchIndex + 1, batches.length);
  }

  if (!payload) throw new Error('Claude did not produce a PPTX generation response.');
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

async function completeClaudeBatch(
  apiKey: string,
  body: Record<string, unknown>,
  batchNumber: number,
  totalBatches: number,
): Promise<Record<string, unknown>> {
  let payload = await sendClaudeMessage(apiKey, body, batchNumber, totalBatches);

  for (let resumeCount = 0; payload.stop_reason === 'pause_turn' && resumeCount < 3; resumeCount += 1) {
    const containerId = getContainerId(payload);
    const assistantContent = payload.content;
    if (!containerId || !Array.isArray(assistantContent)) {
      throw new Error(`Claude paused PPTX batch ${batchNumber} without a reusable container response.`);
    }
    payload = await sendClaudeMessage(apiKey, {
      ...body,
      container: { id: containerId },
      messages: [
        ...(Array.isArray(body.messages) ? body.messages : []),
        { role: 'assistant', content: assistantContent },
        { role: 'user', content: `Continue PPTX batch ${batchNumber} of ${totalBatches}. Save the partial deck before responding.` },
      ],
    }, batchNumber, totalBatches);
  }
  if (payload.stop_reason === 'pause_turn') {
    throw new Error(`Claude PPTX batch ${batchNumber} exceeded the continuation limit. Retry the PPTX job.`);
  }
  return payload;
}

async function sendClaudeMessage(
  apiKey: string,
  body: Record<string, unknown>,
  batchNumber: number,
  totalBatches: number,
): Promise<Record<string, unknown>> {
  let lastError: unknown;
  for (let attempt = 1; attempt <= CLAUDE_NETWORK_RETRY_COUNT; attempt += 1) {
    try {
      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: { ...anthropicHeaders(apiKey), 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(CLAUDE_MESSAGE_TIMEOUT_MS),
      });
      const payload = await response.json() as Record<string, unknown> & { error?: { message?: string } };
      if (!response.ok) throw new Error(payload.error?.message ?? 'Claude pptx skill request failed.');
      return payload;
    } catch (error) {
      lastError = error;
      const isLastAttempt = attempt === CLAUDE_NETWORK_RETRY_COUNT;
      if (isLastAttempt) break;
      console.warn(JSON.stringify({
        event: 'pptx.worker.claude_batch_retry',
        batchNumber,
        totalBatches,
        attempt,
        error: describeClaudeRequestError(error),
      }));
      await delay(attempt * 2_000);
    }
  }

  throw new Error(
    `Claude PPTX batch ${batchNumber} of ${totalBatches} could not be completed: ${describeClaudeRequestError(lastError)}`,
  );
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

function chunk<T>(items: T[], size: number): T[][] {
  const groups: T[][] = [];
  for (let index = 0; index < items.length; index += size) {
    groups.push(items.slice(index, index + size));
  }
  return groups;
}

function delay(milliseconds: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

function describeClaudeRequestError(error: unknown): string {
  if (error instanceof DOMException && error.name === 'TimeoutError') {
    return 'Claude did not respond within four minutes for this small slide batch.';
  }
  if (error instanceof Error && error.message === 'fetch failed') {
    return 'The network connection to Claude was interrupted.';
  }
  return error instanceof Error ? error.message : 'Unknown Claude request error.';
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function logEvent(event: string, details: Record<string, string | number>): void {
  console.info(JSON.stringify({ event, ...details }));
}
