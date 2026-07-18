import type { PptExportService } from '@/interfaces/pptMaker.interface';
import { createFallbackLayout } from '@/services/pptDocument.service';
import type {
  GeneratedImageDeck,
  GeneratedSlideImage,
  PptDeckPlan,
  PptDocumentEnhancement,
  PptEditableShape,
  PptEditableSlideLayout,
  PptEditableTextBlock,
  SlidePlan,
} from '@/types/models/pptMaker.model';
import { stripEllipsis } from '@/utils/pptMaker';
import type PptxGenJS from 'pptxgenjs';

const SLIDE_W = 13.333;
const SLIDE_H = 7.5;
const FONT_FACE = 'Pretendard';
const WHITE = 'FFFFFF';
const NAVY = '0B2454';
const BORDER = 'E5EAF2';

type PptxSlide = ReturnType<PptxGenJS['addSlide']>;
type PptxPresentation = PptxGenJS;

export const pptExportService: PptExportService = {
  async exportImageDeck(
    deck,
    deckPlan = null,
    fileName = 'qlearn-editable-deck.pptx',
    enhancement,
  ) {
    const pptx = await buildPresentation(deck, deckPlan, fileName, enhancement);
    await pptx.writeFile({ fileName: enhancement?.fileName ?? fileName });
  },

  async createImageDeckBlob(deck, deckPlan = null, enhancement) {
    const pptx = await buildPresentation(deck, deckPlan, enhancement?.fileName ?? 'qlearn-editable-deck.pptx', enhancement);
    const output = await pptx.write({ outputType: 'blob' });
    if (output instanceof Blob) return output;

    const blobType = 'application/vnd.openxmlformats-officedocument.presentationml.presentation';
    if (typeof output === 'string') return new Blob([output], { type: blobType });
    if (output instanceof ArrayBuffer) return new Blob([output], { type: blobType });
    return new Blob([new Uint8Array(output).slice().buffer], { type: blobType });
  },
};

async function buildPresentation(
  deck: GeneratedImageDeck,
  deckPlan: PptDeckPlan | null,
  fileName: string,
  enhancement?: PptDocumentEnhancement,
): Promise<PptxPresentation> {
  const pptxModule = await import('pptxgenjs');
  const pptx = new pptxModule.default();
  pptx.layout = 'LAYOUT_WIDE';
  pptx.author = 'QLEARN';
  pptx.subject = 'Editable presentation deck generated from an approved copy plan';
  pptx.title = enhancement?.title ?? deckPlan?.title ?? fileName.replace(/\.pptx$/iu, '');
  pptx.company = 'QLEARN';

  const images = await loadImageData(deck);
  images.forEach((image) => {
    const slide = pptx.addSlide();
    slide.background = { color: WHITE };
    const plan = deckPlan?.slides.find((candidate) => candidate.id === image.slideId);
    const layout = plan
      ? enhancement?.layouts.find((candidate) => candidate.pageNumber === image.pageNumber) ??
        createFallbackLayout(plan, Boolean(deckPlan?.request.logoImageDataUrl))
      : null;

    if (layout && plan) {
      addLayoutDrivenSlide(pptx, slide, image, layout, deckPlan?.request.logoImageDataUrl);
    } else {
      addImageOnlySlide(slide, image);
    }

    const note = enhancement?.speakerNotes.find((item) => item.pageNumber === image.pageNumber)?.note;
    if (note && 'addNotes' in slide && typeof slide.addNotes === 'function') slide.addNotes(note);
  });

  if (deckPlan?.slides[0]) {
    const slide = pptx.addSlide();
    slide.background = { color: WHITE };
    addManualTemplateSlide(pptx, slide, deckPlan.slides[0], deckPlan.request.logoImageDataUrl);
  }

  return pptx;
}

async function loadImageData(deck: GeneratedImageDeck): Promise<Array<GeneratedSlideImage & { imageDataUrl?: string }>> {
  const sorted = deck.images.slice().sort((left, right) => left.pageNumber - right.pageNumber);
  return Promise.all(
    sorted.map(async (image) => ({
      ...image,
      imageDataUrl: image.imageDataUrl ?? (image.imageUrl ? await imageUrlToDataUrl(image.imageUrl) : undefined),
    })),
  );
}

function addLayoutDrivenSlide(
  pptx: PptxPresentation,
  slide: PptxSlide,
  image: GeneratedSlideImage & { imageDataUrl?: string },
  layout: PptEditableSlideLayout,
  logoImageDataUrl?: string,
): void {
  addImageLayer(slide, image, layout);
  if (layout.visualStrategy === 'image-fallback') return;
  layout.shapes.forEach((shape) => addEditableShape(pptx, slide, shape));
  layout.textBlocks.forEach((block) => addEditableTextBlock(pptx, slide, block, logoImageDataUrl));
}

function addImageLayer(
  slide: PptxSlide,
  image: GeneratedSlideImage & { imageDataUrl?: string },
  layout: PptEditableSlideLayout,
): void {
  if (!image.imageDataUrl) return;
  const { imageLayer } = layout;
  if (imageLayer.strategy !== 'visual-crop') {
    slide.addImage({ data: image.imageDataUrl, x: 0, y: 0, w: SLIDE_W, h: SLIDE_H });
    return;
  }
  slide.addImage({
    data: image.imageDataUrl,
    x: imageLayer.x,
    y: imageLayer.y,
    w: imageLayer.w,
    h: imageLayer.h,
    transparency: imageLayer.transparency ?? 0,
  });
}

function addEditableShape(pptx: PptxPresentation, slide: PptxSlide, shape: PptEditableShape): void {
  const shapeType = {
    rect: pptx.ShapeType.rect,
    roundRect: pptx.ShapeType.roundRect,
    ellipse: pptx.ShapeType.ellipse,
    line: pptx.ShapeType.line,
  }[shape.type];

  slide.addShape(shapeType, {
    x: shape.x,
    y: shape.y,
    w: shape.w,
    h: shape.h,
    fill: { color: shape.fillColor ?? WHITE, transparency: shape.transparency ?? (shape.fillColor ? 0 : 100) },
    line: { color: shape.lineColor ?? BORDER, width: shape.lineWidth ?? 0.75, transparency: shape.transparency ?? 0 },
  });
}

function addEditableTextBlock(
  pptx: PptxPresentation,
  slide: PptxSlide,
  block: PptEditableTextBlock,
  logoImageDataUrl?: string,
): void {
  if (block.role === 'logo') {
    addLogoBlock(pptx, slide, block, logoImageDataUrl);
    return;
  }

  const text = safeText(block.text);
  if (!text) return;
  slide.addText(text, {
    x: block.x,
    y: block.y,
    w: block.w,
    h: block.h,
    fontFace: FONT_FACE,
    fontSize: block.fontSize,
    bold: block.bold ?? false,
    color: block.color ?? NAVY,
    align: block.align ?? 'left',
    fit: 'shrink',
    margin: 0,
    breakLine: false,
  });
}

function addLogoBlock(
  pptx: PptxPresentation,
  slide: PptxSlide,
  block: PptEditableTextBlock,
  logoImageDataUrl?: string,
): void {
  if (logoImageDataUrl) {
    slide.addImage({
      data: logoImageDataUrl,
      x: block.x,
      y: block.y,
      w: block.w,
      h: block.h,
      sizing: { type: 'contain', x: block.x, y: block.y, w: block.w, h: block.h },
    });
    return;
  }

  slide.addShape(pptx.ShapeType.roundRect, {
    x: block.x,
    y: block.y,
    w: block.w,
    h: block.h,
    rectRadius: 0.06,
    fill: { color: WHITE },
    line: { color: BORDER, width: 0.75 },
  });
  slide.addText(safeText(block.text) || '\uB85C\uACE0', {
    x: block.x,
    y: block.y + Math.max(0.02, block.h * 0.22),
    w: block.w,
    h: Math.max(0.14, block.h * 0.48),
    fontFace: FONT_FACE,
    fontSize: block.fontSize,
    bold: true,
    color: block.color ?? '85878A',
    align: 'center',
    fit: 'shrink',
    margin: 0,
  });
}

function addManualTemplateSlide(
  pptx: PptxPresentation,
  slide: PptxSlide,
  styleSeed: SlidePlan,
  logoImageDataUrl?: string,
): void {
  const manualPlan: SlidePlan = {
    ...styleSeed,
    id: 'manual-template-slide',
    pageNumber: 0,
    title: '\uC218\uB3D9 \uCD94\uAC00 \uC6A9 \uC2AC\uB77C\uC774\uB4DC',
    subtitle: '\uD544\uC694\uD55C \uB0B4\uC6A9\uC744 \uC785\uB825\uD574 \uB3D9\uC77C\uD55C \uC2A4\uD0C0\uC77C\uB85C \uC0AC\uC6A9\uD558\uC138\uC694.',
    mainMessage: '\uD575\uC2EC \uBA54\uC2DC\uC9C0\uB97C \uC785\uB825\uD558\uC138\uC694.',
    labels: ['\uBC30\uACBD', '\uD575\uC2EC \uC815\uBCF4', '\uC2E4\uD589'],
    takeaway: '\uC694\uC57D \uBA54\uC2DC\uC9C0\uB97C \uC785\uB825\uD558\uC138\uC694.',
    imagePrompt: '',
  };
  slide.addShape(pptx.ShapeType.rect, {
    x: 0.55,
    y: 0.42,
    w: 0.07,
    h: 0.95,
    fill: { color: NAVY },
    line: { color: NAVY, transparency: 100 },
  });
  [
    { id: 'title', role: 'title' as const, text: manualPlan.title, x: 0.82, y: 0.42, w: 7.25, h: 0.52, fontSize: 25, bold: true, color: NAVY },
    { id: 'subtitle', role: 'subtitle' as const, text: manualPlan.subtitle, x: 0.82, y: 1.02, w: 6.0, h: 0.32, fontSize: 11, color: '6B7280' },
    { id: 'label-1', role: 'label' as const, text: manualPlan.labels[0], x: 0.9, y: 2.35, w: 1.8, h: 0.28, fontSize: 14, bold: true, color: NAVY, align: 'center' as const },
    { id: 'label-2', role: 'label' as const, text: manualPlan.labels[1], x: 3.1, y: 2.35, w: 1.8, h: 0.28, fontSize: 14, bold: true, color: NAVY, align: 'center' as const },
    { id: 'label-3', role: 'label' as const, text: manualPlan.labels[2], x: 5.3, y: 2.35, w: 1.25, h: 0.28, fontSize: 14, bold: true, color: NAVY, align: 'center' as const },
    { id: 'takeaway', role: 'takeaway' as const, text: manualPlan.takeaway, x: 0.9, y: 5.7, w: 11.15, h: 0.3, fontSize: 13, bold: true, color: NAVY, align: 'center' as const },
    { id: 'logo', role: 'logo' as const, text: logoImageDataUrl ? '' : '로고', x: 11.62, y: 0.38, w: 1.12, h: 0.34, fontSize: 8, bold: true, color: '85878A', align: 'center' as const },
  ].forEach((block) => addEditableTextBlock(pptx, slide, block, logoImageDataUrl));
  slide.addShape(pptx.ShapeType.roundRect, {
    x: 6.85,
    y: 1.28,
    w: 5.85,
    h: 3.75,
    rectRadius: 0.08,
    fill: { color: 'EFF5FE', transparency: 18 },
    line: { color: BORDER, width: 1 },
  });
  slide.addText('\uC774\uBBF8\uC9C0 \uB610\uB294 \uB2E4\uC774\uC5B4\uADF8\uB7A8 \uC601\uC5ED', {
    x: 7.25,
    y: 2.95,
    w: 5.05,
    h: 0.32,
    fontFace: FONT_FACE,
    fontSize: 15,
    bold: true,
    color: NAVY,
    align: 'center',
    margin: 0,
    fit: 'shrink',
  });
}

function addImageOnlySlide(slide: PptxSlide, image: GeneratedSlideImage & { imageDataUrl?: string }): void {
  if (!image.imageDataUrl) return;
  slide.addImage({ data: image.imageDataUrl, x: 0, y: 0, w: SLIDE_W, h: SLIDE_H });
}

function safeText(value: string): string {
  return stripEllipsis(value).replace(/\s+/g, ' ').trim();
}

async function imageUrlToDataUrl(imageUrl: string): Promise<string> {
  const response = await fetch(imageUrl);
  if (!response.ok) throw new Error(`Failed to load generated slide image: ${response.status}`);
  const blob = await response.blob();
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Failed to convert generated slide image.'));
    reader.onload = () => typeof reader.result === 'string'
      ? resolve(reader.result)
      : reject(new Error('Generated slide image conversion returned an invalid result.'));
    reader.readAsDataURL(blob);
  });
}
