import type { PptExportService } from '@/interfaces/pptMaker.interface';
import type {
  PptDeckPlan,
  PptDocumentEnhancement,
  PptEditableShape,
  PptEditableTextBlock,
} from '@/types/models/pptMaker.model';
import { stripEllipsis } from '@/utils/pptMaker';
import type PptxGenJS from 'pptxgenjs';

const MIME_TYPE = 'application/vnd.openxmlformats-officedocument.presentationml.presentation';
const FONT_FACE = 'Pretendard';
const WHITE = 'FFFFFF';
const NAVY = '0B2454';
const BORDER = 'D8E1EF';

type PptxSlide = ReturnType<PptxGenJS['addSlide']>;
type PptxPresentation = PptxGenJS;

export const pptExportService: PptExportService = {
  async exportDeck(deckPlan, enhancement, slideElements) {
    const blob = await createPresentationBlob(deckPlan, enhancement, slideElements);
    triggerDownload(blob, enhancement.fileName);
  },

  async createDeckBlob(deckPlan, enhancement, slideElements = []) {
    return createPresentationBlob(deckPlan, enhancement, slideElements);
  },

  downloadBlob(blob, fileName) {
    triggerDownload(blob, fileName);
  },
};

async function createPresentationBlob(
  deckPlan: PptDeckPlan,
  enhancement: PptDocumentEnhancement,
  slideElements: HTMLElement[] = [],
): Promise<Blob> {
    if (slideElements.length > 0) {
      try {
        return await createDomPptxBlob(slideElements, enhancement.fileName);
      } catch (error) {
        console.warn('dom-to-pptx export failed; using PptxGenJS fallback.', error);
      }
    }

    return createPptxGenFallbackBlob(deckPlan, enhancement);
}

async function createDomPptxBlob(slideElements: HTMLElement[], fileName: string): Promise<Blob> {
  const { exportToPptx } = await import('dom-to-pptx');
  const result = await exportToPptx(slideElements, {
    fileName,
    skipDownload: true,
    autoEmbedFonts: false,
    svgAsVector: true,
    layout: 'LAYOUT_WIDE',
  });

  if (!(result instanceof Blob) || result.size === 0) {
    throw new Error('dom-to-pptx returned no PPTX file.');
  }
  return result;
}

async function createPptxGenFallbackBlob(
  deckPlan: PptDeckPlan,
  enhancement: PptDocumentEnhancement,
): Promise<Blob> {
  const pptxModule = await import('pptxgenjs');
  const pptx = new pptxModule.default();
  pptx.layout = 'LAYOUT_WIDE';
  pptx.author = 'QLEARN';
  pptx.subject = 'Editable presentation deck generated from approved Slide JSON';
  pptx.title = enhancement.title;
  pptx.company = 'QLEARN';

  deckPlan.slides.forEach((plan) => {
    const layout = enhancement.layouts.find((candidate) => candidate.pageNumber === plan.pageNumber);
    if (!layout) return;
    const slide = pptx.addSlide();
    slide.background = { color: WHITE };
    layout.shapes.forEach((shape) => addShape(pptx, slide, shape));
    layout.textBlocks.forEach((block) => addText(pptx, slide, block, deckPlan.request.logoImageDataUrl));
    const note = enhancement.speakerNotes.find((item) => item.pageNumber === plan.pageNumber)?.note;
    if (note && 'addNotes' in slide && typeof slide.addNotes === 'function') slide.addNotes(note);
  });

  addManualTemplateSlide(pptx, deckPlan, enhancement);
  const output = await pptx.write({ outputType: 'blob' });
  if (output instanceof Blob) return output;
  if (output instanceof ArrayBuffer) return new Blob([output], { type: MIME_TYPE });
  if (typeof output === 'string') return new Blob([output], { type: MIME_TYPE });
  return new Blob([new Uint8Array(output).slice().buffer], { type: MIME_TYPE });
}

function addShape(pptx: PptxPresentation, slide: PptxSlide, shape: PptEditableShape): void {
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

function addText(pptx: PptxPresentation, slide: PptxSlide, block: PptEditableTextBlock, logoImageDataUrl?: string): void {
  if (block.role === 'logo') {
    if (logoImageDataUrl) {
      slide.addImage({ data: logoImageDataUrl, x: block.x, y: block.y, w: block.w, h: block.h, sizing: { type: 'contain', x: block.x, y: block.y, w: block.w, h: block.h } });
      return;
    }
    slide.addShape(pptx.ShapeType.roundRect, { x: block.x, y: block.y, w: block.w, h: block.h, rectRadius: 0.06, fill: { color: WHITE }, line: { color: BORDER, width: 0.75 } });
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
  });
}

function addManualTemplateSlide(pptx: PptxPresentation, deckPlan: PptDeckPlan, enhancement: PptDocumentEnhancement): void {
  const slide = pptx.addSlide();
  slide.background = { color: WHITE };
  slide.addShape(pptx.ShapeType.rect, { x: 0.52, y: 0.52, w: 0.06, h: 1.2, fill: { color: 'FE6621' }, line: { color: 'FE6621', transparency: 100 } });
  const title = deckPlan.request.targetLanguage === 'Korean' ? '\uC218\uB3D9 \uCD94\uAC00 \uC6A9 \uC2AC\uB77C\uC774\uB4DC' : 'Manual slide template';
  const subtitle = deckPlan.request.targetLanguage === 'Korean' ? '\uD544\uC694\uD55C \uB0B4\uC6A9\uC744 \uC785\uB825\uD574 \uB3D9\uC77C\uD55C \uC2A4\uD0C0\uC77C\uB85C \uC0AC\uC6A9\uD558\uC138\uC694.' : 'Add new content using the same editable design system.';
  slide.addText(title, { x: 0.76, y: 0.5, w: 8.8, h: 0.5, fontFace: FONT_FACE, fontSize: 25, bold: true, color: NAVY, margin: 0, fit: 'shrink' });
  slide.addText(subtitle, { x: 0.76, y: 1.06, w: 8.8, h: 0.3, fontFace: FONT_FACE, fontSize: 11.5, color: '5F6F89', margin: 0, fit: 'shrink' });
  slide.addShape(pptx.ShapeType.roundRect, { x: 0.88, y: 2.0, w: 11.55, h: 3.75, rectRadius: 0.08, fill: { color: 'EFF5FE' }, line: { color: BORDER, width: 1 } });
  slide.addText(deckPlan.request.targetLanguage === 'Korean' ? '\uC5EC\uAE30\uC5D0 \uC218\uB3D9\uC73C\uB85C \uCD94\uAC00\uD560 \uB0B4\uC6A9\uC744 \uC785\uB825\uD558\uC138\uC694.' : 'Add editable text, diagrams, charts, or tables here.', { x: 1.35, y: 3.63, w: 10.65, h: 0.36, fontFace: FONT_FACE, fontSize: 20, bold: true, color: NAVY, align: 'center', margin: 0, fit: 'shrink' });
  slide.addShape(pptx.ShapeType.line, { x: 0.52, y: 6.52, w: 12.25, h: 0, line: { color: BORDER, width: 1 } });
  slide.addText('QLEARN', { x: 0.76, y: 6.76, w: 1.4, h: 0.25, fontFace: FONT_FACE, fontSize: 10.5, bold: true, color: NAVY, margin: 0 });
  slide.addText(String(deckPlan.slides.length + 1).padStart(2, '0'), { x: 12.15, y: 6.69, w: 0.5, h: 0.16, fontFace: FONT_FACE, fontSize: 9.5, bold: true, color: 'FFFFFF', align: 'center', margin: 0 });
  void enhancement;
}

function safeText(value: string): string {
  return stripEllipsis(value).replace(/\s+/g, ' ').trim();
}

function triggerDownload(blob: Blob, fileName: string): void {
  const anchor = document.createElement('a');
  anchor.href = URL.createObjectURL(blob);
  anchor.download = fileName;
  anchor.click();
  window.setTimeout(() => URL.revokeObjectURL(anchor.href), 0);
}
