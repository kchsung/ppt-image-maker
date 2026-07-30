import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import PptxGenJS from 'pptxgenjs';

type ImagePlacement = 'right-hero' | 'left-hero' | 'center-visual' | 'card-visual' | 'hub-visual' | 'full-bleed-visual';
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
  imageSlot?: { id: string; purpose: string; placement: ImagePlacement; prompt: string };
};
type DeckPlan = {
  id: string;
  title: string;
  request: { targetLanguage: 'English' | 'Korean'; audience: string; purpose: string; logoImageDataUrl?: string };
  slides: SlidePlan[];
};
type SlideImage = { id: string; pageNumber: number; imageDataUrl?: string; imageUrl?: string; slotId?: string };
type WorkerRequest = { deckPlan?: DeckPlan; imageDeck?: { generationJobId?: string; images?: SlideImage[] }; executionId?: string };

const PPTX_CONTENT_TYPE = 'application/vnd.openxmlformats-officedocument.presentationml.presentation';
const WIDE_WIDTH = 13.333;
const WIDE_HEIGHT = 7.5;
const COLORS = { navy: '0B2454', orange: 'FE6621', ink: '18253D', muted: '5F6F89', line: 'D8E1EF', pale: 'F3F6FB', warm: 'FFF7EE', white: 'FFFFFF' };
const FONT = 'Pretendard';

export async function runPptxWorker(request: Request): Promise<Response> {
  const secret = process.env.PPT_WORKER_SECRET;
  if (!secret || request.headers.get('x-ppt-worker-secret') !== secret) return Response.json({ error: 'Unauthorized worker request.' }, { status: 401 });

  let jobId: string | undefined;
  let executionId: string | undefined;
  let supabase: SupabaseClient | null = null;
  try {
    const body = await request.json() as WorkerRequest;
    if (!body.deckPlan || !body.imageDeck?.generationJobId || !body.imageDeck.images?.length || !body.executionId) {
      return Response.json({ error: 'deckPlan, visual assets, and an execution ID are required.' }, { status: 400 });
    }
    jobId = body.imageDeck.generationJobId;
    executionId = body.executionId;
    supabase = createAdminClient();
    logEvent('pptx.worker.started', { jobId, executionId, slideCount: body.deckPlan.slides.length });
    await updateStatus(supabase, jobId, 'processing', null, 12, 'Loading generated visual assets', executionId);

    const pptxBytes = await buildEditablePptx(body.deckPlan, body.imageDeck.images, async (completed, total) => {
      const progress = 18 + Math.round((completed / total) * 68);
      await updateStatus(supabase!, jobId!, 'processing', null, progress, `Assembling editable slide ${completed} of ${total}`, executionId!);
    });
    await updateStatus(supabase, jobId, 'processing', null, 90, 'Saving editable PPTX to Supabase Storage', executionId);
    const storagePath = `${jobId}/final/${createFileName(body.deckPlan.title)}`;
    const { error: uploadError } = await supabase.storage.from('ppt-generations').upload(storagePath, pptxBytes, { contentType: PPTX_CONTENT_TYPE, upsert: true });
    if (uploadError) throw uploadError;
    const { error: updateError } = await supabase.from('generation_jobs').update({
      result_path: `ppt-generations/${storagePath}`,
      error_message: null,
      updated_at: new Date().toISOString(),
    }).eq('id', jobId);
    if (updateError) throw updateError;
    await updateStatus(supabase, jobId, 'succeeded', null, 100, 'Ready to preview and download', executionId);
    logEvent('pptx.worker.completed', { jobId, executionId });
    return Response.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'PptxGenJS worker failed.';
    console.error(JSON.stringify({ event: 'pptx.worker.failed', jobId: jobId ?? null, executionId: executionId ?? null, error: message }));
    if (supabase && jobId && executionId) await updateStatus(supabase, jobId, 'failed', message, 0, 'PPTX generation failed', executionId).catch(() => undefined);
    throw error;
  }
}

export default runPptxWorker;

async function buildEditablePptx(
  deckPlan: DeckPlan,
  assets: SlideImage[],
  onSlideComplete: (completed: number, total: number) => Promise<void>,
): Promise<Uint8Array> {
  const pptx = new (PptxGenJS as unknown as new () => any)();
  pptx.layout = 'LAYOUT_WIDE';
  pptx.author = 'QLEARN PPT Maker';
  pptx.subject = 'Native editable presentation';
  pptx.title = deckPlan.title;
  pptx.company = 'QLEARN';
  pptx.lang = deckPlan.request.targetLanguage === 'Korean' ? 'ko-KR' : 'en-US';
  pptx.theme = { headFontFace: FONT, bodyFontFace: FONT, lang: pptx.lang };
  pptx.defineLayout({ name: 'QLEARN_WIDE', width: WIDE_WIDTH, height: WIDE_HEIGHT });
  pptx.layout = 'QLEARN_WIDE';
  const assetByPage = new Map(assets.map((asset) => [asset.pageNumber, asset]));

  for (const [index, plan] of deckPlan.slides.entries()) {
    const slide = pptx.addSlide();
    const imageData = await resolveImageData(assetByPage.get(plan.pageNumber));
    renderSlide(slide, plan, imageData, deckPlan.request.logoImageDataUrl);
    await onSlideComplete(index + 1, deckPlan.slides.length);
  }
  renderManualTemplateSlide(pptx.addSlide(), deckPlan, deckPlan.slides.length + 1);
  const output = await pptx.write({ outputType: 'nodebuffer' });
  return new Uint8Array(output as ArrayBuffer | Uint8Array);
}

function renderSlide(slide: any, plan: SlidePlan, imageData: string | null, logoData: string | undefined): void {
  slide.background = { color: COLORS.white };
  slide.addShape('rect', { x: 0, y: 0, w: WIDE_WIDTH, h: WIDE_HEIGHT, line: { color: COLORS.white, transparency: 100 }, fill: { color: COLORS.white } });
  slide.addShape('rect', { x: 0.52, y: 0.52, w: 0.06, h: 1.2, line: { color: COLORS.orange, transparency: 100 }, fill: { color: COLORS.orange } });
  addText(slide, plan.title, 0.76, 0.5, 8.8, 0.48, 25, COLORS.navy, true);
  addText(slide, plan.subtitle, 0.76, 1.03, 8.8, 0.32, 11.5, COLORS.muted, false);
  addLogo(slide, logoData);

  const imageBox = getImageBox(plan.imageSlot?.placement ?? 'right-hero', plan.visualStructure);
  renderStructure(slide, plan, imageBox);
  if (imageData) addAsset(slide, imageData, imageBox);
  addText(slide, plan.takeaway, 0.76, 6.76, 10.95, 0.3, 10.5, COLORS.navy, true);
  slide.addShape('line', { x: 0.52, y: 6.52, w: 12.25, h: 0, line: { color: COLORS.line, width: 1 } });
  slide.addShape('ellipse', { x: 12.15, y: 6.57, w: 0.5, h: 0.5, line: { color: COLORS.navy, transparency: 100 }, fill: { color: COLORS.navy } });
  addText(slide, String(plan.pageNumber).padStart(2, '0'), 12.15, 6.69, 0.5, 0.16, 9.5, COLORS.white, true, 'center');
}

function renderStructure(slide: any, plan: SlidePlan, imageBox: Box): void {
  const labels = plan.labels.slice(0, 5);
  const addLabel = (label: string, x: number, y: number, w: number, h = 0.52) => {
    slide.addShape('roundRect', { x, y, w, h, rectRadius: 0.08, fill: { color: COLORS.pale }, line: { color: COLORS.line, width: 1 } });
    addText(slide, label, x + 0.08, y + 0.16, w - 0.16, h - 0.16, 10.5, COLORS.navy, true, 'center');
  };
  const addMessage = (x: number, y: number, w: number, h: number) => addText(slide, plan.mainMessage, x, y, w, h, 14, COLORS.ink, false);

  switch (plan.visualStructure) {
    case 'hero-visual':
      addMessage(0.86, 2.05, 5.2, 1.05);
      labels.slice(0, 3).forEach((label, index) => addLabel(label, 0.86 + index * 1.74, 3.5, 1.52));
      break;
    case 'message-emphasis':
      slide.addShape('roundRect', { x: 0.86, y: 2.15, w: 7.1, h: 1.52, rectRadius: 0.12, fill: { color: COLORS.navy }, line: { color: COLORS.navy, transparency: 100 } });
      addText(slide, plan.mainMessage, 1.15, 2.58, 6.52, 0.65, 20, COLORS.white, true, 'center');
      labels.slice(0, 3).forEach((label, index) => addLabel(label, 1.05 + index * 2.2, 4.25, 1.9));
      break;
    case 'side-by-side-comparison':
    case 'before-after-mapping':
      addPanel(slide, labels[0] ?? 'Current', 0.86, 2.15, 2.72, 2.6, COLORS.pale);
      addPanel(slide, labels[1] ?? 'Future', 4.1, 2.15, 2.72, 2.6, COLORS.warm);
      slide.addShape('chevron', { x: 3.65, y: 3.2, w: 0.3, h: 0.45, fill: { color: COLORS.orange }, line: { color: COLORS.orange, transparency: 100 } });
      addMessage(0.92, 5.02, 5.9, 0.72);
      break;
    case 'numbered-process':
    case 'roadmap':
      labels.slice(0, 4).forEach((label, index) => {
        const x = 0.88 + index * 1.54;
        slide.addShape('ellipse', { x: x + 0.42, y: 2.25, w: 0.52, h: 0.52, fill: { color: index % 2 ? COLORS.orange : COLORS.navy }, line: { color: COLORS.white, transparency: 100 } });
        addText(slide, String(index + 1), x + 0.42, 2.39, 0.52, 0.14, 9.5, COLORS.white, true, 'center');
        addLabel(label, x, 2.98, 1.36, 0.74);
        if (index < labels.length - 1) slide.addShape('line', { x: x + 1.36, y: 2.5, w: 0.18, h: 0, line: { color: COLORS.line, width: 2 } });
      });
      addMessage(0.9, 4.35, 5.9, 0.7);
      break;
    case 'hub-and-spoke':
      slide.addShape('ellipse', { x: 2.9, y: 3.05, w: 1.55, h: 1.2, fill: { color: COLORS.navy }, line: { color: COLORS.navy, transparency: 100 } });
      addText(slide, labels[0] ?? 'Core', 3.05, 3.52, 1.25, 0.2, 14, COLORS.white, true, 'center');
      labels.slice(1, 4).forEach((label, index) => {
        const positions = [[0.9, 2.25], [5.25, 2.25], [5.25, 4.55]];
        const [x, y] = positions[index] ?? [0.9, 4.55];
        addLabel(label, x, y, 1.55, 0.66);
        slide.addShape('line', { x: x < 3 ? x + 1.55 : 4.45, y: y + 0.32, w: x < 3 ? 0.45 : 0.8, h: 0.6, line: { color: COLORS.line, width: 1.5 } });
      });
      break;
    case 'metrics-dashboard':
      labels.slice(0, 3).forEach((label, index) => {
        const x = 0.86 + index * 2.02;
        slide.addShape('roundRect', { x, y: 2.2, w: 1.78, h: 1.32, rectRadius: 0.1, fill: { color: COLORS.pale }, line: { color: COLORS.line, width: 1 } });
        addText(slide, label, x + 0.12, 2.48, 1.54, 0.22, 10, COLORS.muted, true, 'center');
        addText(slide, ['01', '02', '03'][index], x + 0.12, 2.82, 1.54, 0.3, 22, COLORS.navy, true, 'center');
      });
      addMessage(0.88, 4.05, 5.85, 0.75);
      break;
    case 'pyramid-framework':
      labels.slice(0, 4).reverse().forEach((label, index) => {
        const width = 2.0 + index * 0.85;
        const x = 3.55 - width / 2;
        const y = 4.9 - index * 0.63;
        slide.addShape('trapezoid', { x, y, w: width, h: 0.48, fill: { color: index % 2 ? COLORS.warm : COLORS.pale }, line: { color: COLORS.line, width: 1 } });
        addText(slide, label, x, y + 0.13, width, 0.16, 9.5, COLORS.navy, true, 'center');
      });
      break;
    case 'case-story':
    case 'card-grid':
    case 'closing-commitment':
    default:
      labels.slice(0, 4).forEach((label, index) => {
        const x = 0.86 + (index % 2) * 3.0;
        const y = 2.15 + Math.floor(index / 2) * 1.08;
        addPanel(slide, label, x, y, 2.55, 0.83, index % 2 ? COLORS.warm : COLORS.pale);
      });
      addMessage(0.9, 4.65, 5.9, 0.72);
      break;
  }
  if (plan.visualStructure !== 'hero-visual' && plan.visualStructure !== 'closing-commitment') addText(slide, plan.mainMessage, 0.86, 5.35, 5.95, 0.6, 11.5, COLORS.muted, false);
  void imageBox;
}

function getImageBox(placement: ImagePlacement, structure: string): Box {
  if (placement === 'left-hero') return { x: 0.85, y: 2.0, w: 4.75, h: 3.75 };
  if (placement === 'center-visual' || placement === 'hub-visual') return { x: 7.75, y: 1.82, w: 4.45, h: 4.45 };
  if (placement === 'full-bleed-visual') return { x: 7.15, y: 1.62, w: 5.3, h: 4.85 };
  if (placement === 'card-visual' || structure === 'card-grid') return { x: 7.35, y: 2.05, w: 4.9, h: 3.85 };
  return { x: 7.55, y: 1.82, w: 4.72, h: 4.65 };
}

type Box = { x: number; y: number; w: number; h: number };
function addPanel(slide: any, title: string, x: number, y: number, w: number, h: number, fill: string): void {
  slide.addShape('roundRect', { x, y, w, h, rectRadius: 0.08, fill: { color: fill }, line: { color: COLORS.line, width: 1 } });
  addText(slide, title, x + 0.12, y + h / 2 - 0.12, w - 0.24, 0.24, 11, COLORS.navy, true, 'center');
}
function addAsset(slide: any, data: string, box: Box): void {
  slide.addShape('roundRect', { x: box.x - 0.05, y: box.y - 0.05, w: box.w + 0.1, h: box.h + 0.1, rectRadius: 0.1, fill: { color: COLORS.white }, line: { color: COLORS.line, width: 1.2 } });
  slide.addImage({ data, x: box.x, y: box.y, w: box.w, h: box.h, sizing: { type: 'contain', x: box.x, y: box.y, w: box.w, h: box.h } });
}
function addLogo(slide: any, logoData?: string): void {
  if (logoData) slide.addImage({ data: logoData, x: 11.4, y: 0.43, w: 1.3, h: 0.45, sizing: { type: 'contain', x: 11.4, y: 0.43, w: 1.3, h: 0.45 } });
  else {
    slide.addShape('roundRect', { x: 11.45, y: 0.42, w: 1.14, h: 0.42, rectRadius: 0.06, fill: { color: COLORS.pale }, line: { color: COLORS.line, width: 0.8 } });
    addText(slide, 'Logo', 11.45, 0.55, 1.14, 0.12, 8.5, COLORS.muted, false, 'center');
  }
}
function addText(slide: any, value: string, x: number, y: number, w: number, h: number, fontSize: number, color: string, bold: boolean, align: 'left' | 'center' | 'right' = 'left'): void {
  slide.addText(value, { x, y, w, h, fontFace: FONT, fontSize, color, bold, margin: 0, breakLine: false, fit: 'shrink', valign: 'mid', align, paraSpaceAfterPt: 0, autoFit: true });
}
function renderManualTemplateSlide(slide: any, deckPlan: DeckPlan, pageNumber: number): void {
  slide.background = { color: COLORS.white };
  slide.addShape('rect', { x: 0.52, y: 0.52, w: 0.06, h: 1.2, line: { color: COLORS.orange, transparency: 100 }, fill: { color: COLORS.orange } });
  addText(slide, deckPlan.request.targetLanguage === 'Korean' ? '수동 추가 장표 템플릿' : 'Manual Add-On Slide Template', 0.76, 0.5, 8.7, 0.45, 24, COLORS.navy, true);
  addText(slide, deckPlan.request.targetLanguage === 'Korean' ? '이 장표의 텍스트와 도형을 복제하여 같은 스타일로 내용을 추가하세요.' : 'Duplicate these editable objects to add a slide in the same style.', 0.76, 1.03, 9.8, 0.3, 11.5, COLORS.muted, false);
  ['Title', 'Key message', 'Supporting point', 'Action'].forEach((label, index) => addPanel(slide, label, 0.9 + index * 2.85, 2.35, 2.35, 1.2, index % 2 ? COLORS.warm : COLORS.pale));
  slide.addShape('roundRect', { x: 0.9, y: 4.35, w: 11.45, h: 1.2, rectRadius: 0.1, fill: { color: COLORS.pale }, line: { color: COLORS.line, width: 1 } });
  addText(slide, deckPlan.request.targetLanguage === 'Korean' ? '핵심 메시지 또는 실행 제안을 여기에 입력하세요.' : 'Type the key takeaway or next action here.', 1.25, 4.78, 10.75, 0.25, 15, COLORS.navy, true, 'center');
  addLogo(slide, deckPlan.request.logoImageDataUrl);
  slide.addShape('line', { x: 0.52, y: 6.52, w: 12.25, h: 0, line: { color: COLORS.line, width: 1 } });
  addText(slide, String(pageNumber).padStart(2, '0'), 12.15, 6.69, 0.5, 0.16, 9.5, COLORS.navy, true, 'center');
}

async function resolveImageData(asset: SlideImage | undefined): Promise<string | null> {
  const source = asset?.imageDataUrl ?? asset?.imageUrl;
  if (!source) return null;
  if (source.startsWith('data:')) return source;
  const response = await fetch(source);
  if (!response.ok) throw new Error(`Unable to load visual asset (${response.status}).`);
  const bytes = Buffer.from(await response.arrayBuffer()).toString('base64');
  return `data:${response.headers.get('content-type') ?? 'image/png'};base64,${bytes}`;
}

async function updateStatus(supabase: SupabaseClient, jobId: string, status: 'processing' | 'succeeded' | 'failed', errorMessage: string | null, progress: number, phase: string, executionId: string): Promise<void> {
  const { data: job, error: readError } = await supabase.from('generation_jobs').select('request').eq('id', jobId).single();
  if (readError) throw readError;
  const request = isRecord(job?.request) ? job.request : {};
  const { error } = await supabase.from('generation_jobs').update({ request: { ...request, pptxGeneration: { status, errorMessage, progress, phase, executor: 'netlify-worker', executionId, updatedAt: new Date().toISOString() } }, updated_at: new Date().toISOString() }).eq('id', jobId);
  if (error) throw error;
}
function createAdminClient(): SupabaseClient { return createClient(requiredEnv('SUPABASE_URL'), requiredEnv('SUPABASE_SERVICE_ROLE_KEY')); }
function requiredEnv(name: string): string { const value = process.env[name]; if (!value) throw new Error(`${name} is not configured.`); return value; }
function createFileName(title: string): string { const cleaned = title.replace(/[\\/:*?"<>|]+/g, '-').replace(/\s+/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, ''); return `${cleaned || 'qlearn-editable-deck'}.pptx`; }
function isRecord(value: unknown): value is Record<string, unknown> { return typeof value === 'object' && value !== null; }
function logEvent(event: string, details: Record<string, string | number>): void { console.info(JSON.stringify({ event, ...details })); }
