import type { PptExportService } from '@/interfaces/pptMaker.interface';
import type {
  GeneratedImageDeck,
  GeneratedSlideImage,
  PptDeckPlan,
  PptDocumentEnhancement,
  SlidePlan,
} from '@/types/models/pptMaker.model';
import { stripEllipsis } from '@/utils/pptMaker';
import type PptxGenJS from 'pptxgenjs';

const SLIDE_W = 13.333;
const SLIDE_H = 7.5;
const FONT_FACE = 'Arial';

const C = {
  bg: 'FFFFFF',
  navy: '0B2454',
  navyDeep: '062354',
  orange: 'FE6621',
  body: '333333',
  secondary: '6B7280',
  muted: '9CA3AF',
  footer: '85878A',
  border: 'E5EAF2',
  cardBlue: 'EFF5FE',
  cardGreen: 'EEF8F6',
  cardOrange: 'FEF7EE',
  cardPurple: 'F5F1FE',
};

const CARD_COLORS = [C.cardBlue, C.cardGreen, C.cardOrange, C.cardPurple];

type PptxSlide = ReturnType<PptxGenJS['addSlide']>;
type PptxPresentation = PptxGenJS;

export const pptExportService: PptExportService = {
  async exportImageDeck(
    deck,
    deckPlan = null,
    fileName = 'qlearn-editable-deck.pptx',
    enhancement?: PptDocumentEnhancement,
  ) {
    const pptxModule = await import('pptxgenjs');
    const pptx = new pptxModule.default();

    pptx.layout = 'LAYOUT_WIDE';
    pptx.author = 'QLEARN';
    pptx.subject = 'Editable presentation deck';
    pptx.title = enhancement?.title ?? deckPlan?.title ?? fileName.replace(/\.pptx$/i, '');
    pptx.company = 'QLEARN';

    const imagesWithData = await loadImageData(deck);

    imagesWithData.forEach((image) => {
      if (!image.imageDataUrl) {
        throw new Error(`Slide ${image.pageNumber} does not include image data.`);
      }

      const slide = pptx.addSlide();
      const note = enhancement?.speakerNotes.find((item) => item.pageNumber === image.pageNumber)?.note;
      const plan = deckPlan?.slides.find((item) => item.id === image.slideId);

      slide.background = { color: C.bg };
      if (plan) {
        addEditableSlide(pptx, slide, plan, image);
      } else {
        addImageOnlySlide(slide, image);
      }

      if (note && 'addNotes' in slide && typeof slide.addNotes === 'function') {
        slide.addNotes(note);
      }
    });

    await pptx.writeFile({ fileName: enhancement?.fileName ?? fileName });
  },
};

async function loadImageData(deck: GeneratedImageDeck): Promise<Array<GeneratedSlideImage & { imageDataUrl?: string }>> {
  const sortedImages = deck.images.slice().sort((left, right) => left.pageNumber - right.pageNumber);
  return Promise.all(
    sortedImages.map(async (image) => ({
      ...image,
      imageDataUrl: image.imageDataUrl ?? (image.imageUrl ? await imageUrlToDataUrl(image.imageUrl) : undefined),
    })),
  );
}

function addEditableSlide(
  pptx: PptxPresentation,
  slide: PptxSlide,
  plan: SlidePlan,
  image: GeneratedSlideImage & { imageDataUrl?: string },
): void {
  addHeader(pptx, slide, plan);
  addGeneratedVisual(slide, image);
  addMessageCards(pptx, slide, plan);
  addTakeawayPill(pptx, slide, plan);
  addFooter(pptx, slide, plan);
}

function addHeader(pptx: PptxPresentation, slide: PptxSlide, plan: SlidePlan): void {
  slide.addShape(pptx.ShapeType.rect, {
    x: 0.55,
    y: 0.42,
    w: 0.07,
    h: 0.95,
    fill: { color: C.orange },
    line: { color: C.orange },
  });
  slide.addText(safeText(plan.title), {
    x: 0.8,
    y: 0.34,
    w: 8.1,
    h: 0.48,
    fontFace: FONT_FACE,
    fontSize: 24,
    bold: true,
    color: C.navy,
    fit: 'shrink',
    margin: 0,
    breakLine: false,
  });
  slide.addText(safeText(plan.subtitle), {
    x: 0.8,
    y: 0.9,
    w: 8.1,
    h: 0.32,
    fontFace: FONT_FACE,
    fontSize: 11,
    color: C.secondary,
    fit: 'shrink',
    margin: 0,
  });
  slide.addText(safeText(plan.mainMessage), {
    x: 0.8,
    y: 1.38,
    w: 7.25,
    h: 0.55,
    fontFace: FONT_FACE,
    fontSize: 13,
    color: C.body,
    fit: 'shrink',
    valign: 'middle',
    margin: 0.04,
  });
}

function addGeneratedVisual(slide: PptxSlide, image: GeneratedSlideImage & { imageDataUrl?: string }): void {
  if (!image.imageDataUrl) {
    return;
  }

  slide.addImage({
    data: image.imageDataUrl,
    x: 6.85,
    y: 1.28,
    w: 5.85,
    h: 3.75,
    transparency: 18,
  });
}

function addMessageCards(pptx: PptxPresentation, slide: PptxSlide, plan: SlidePlan): void {
  const labels = plan.labels.length > 0 ? plan.labels.slice(0, 5) : ['Context', 'Decision', 'Action'];
  const cardCount = Math.min(labels.length, 5);
  const cardW = cardCount >= 5 ? 2.2 : 2.55;
  const gap = cardCount >= 5 ? 0.18 : 0.24;
  const totalW = cardCount * cardW + (cardCount - 1) * gap;
  const startX = Math.max(0.75, (SLIDE_W - totalW) / 2);

  labels.slice(0, cardCount).forEach((label, index) => {
    const x = startX + index * (cardW + gap);
    const color = CARD_COLORS[index % CARD_COLORS.length];
    slide.addShape(pptx.ShapeType.roundRect, {
      x,
      y: 3.15,
      w: cardW,
      h: 1.55,
      rectRadius: 0.08,
      fill: { color },
      line: { color: C.border, width: 0.75 },
    });
    slide.addShape(pptx.ShapeType.ellipse, {
      x: x + 0.18,
      y: 3.36,
      w: 0.42,
      h: 0.42,
      fill: { color: index % 2 === 0 ? C.navy : C.orange },
      line: { color: C.bg, transparency: 100 },
    });
    slide.addText(String(index + 1).padStart(2, '0'), {
      x: x + 0.18,
      y: 3.45,
      w: 0.42,
      h: 0.18,
      fontFace: FONT_FACE,
      fontSize: 7,
      bold: true,
      color: C.bg,
      align: 'center',
      margin: 0,
      fit: 'shrink',
    });
    slide.addText(safeText(label), {
      x: x + 0.22,
      y: 3.92,
      w: cardW - 0.44,
      h: 0.28,
      fontFace: FONT_FACE,
      fontSize: 13,
      bold: true,
      color: C.navy,
      align: 'center',
      fit: 'shrink',
      margin: 0,
    });
    slide.addShape(pptx.ShapeType.rect, {
      x: x + cardW / 2 - 0.23,
      y: 4.29,
      w: 0.46,
      h: 0.03,
      fill: { color: C.orange },
      line: { color: C.orange },
    });
    slide.addText(createCardDescription(label, plan.pageNumber), {
      x: x + 0.22,
      y: 4.42,
      w: cardW - 0.44,
      h: 0.26,
      fontFace: FONT_FACE,
      fontSize: 7.8,
      color: C.body,
      align: 'center',
      fit: 'shrink',
      margin: 0,
    });
  });
}

function addTakeawayPill(pptx: PptxPresentation, slide: PptxSlide, plan: SlidePlan): void {
  slide.addShape(pptx.ShapeType.roundRect, {
    x: 1.15,
    y: 5.42,
    w: 11.05,
    h: 0.58,
    rectRadius: 0.28,
    fill: { color: C.bg },
    line: { color: C.navy, width: 1.1 },
  });
  slide.addText(safeText(plan.takeaway), {
    x: 1.45,
    y: 5.56,
    w: 10.45,
    h: 0.25,
    fontFace: FONT_FACE,
    fontSize: 12,
    bold: true,
    color: C.navy,
    align: 'center',
    fit: 'shrink',
    margin: 0,
  });
}

function addFooter(pptx: PptxPresentation, slide: PptxSlide, plan: SlidePlan): void {
  slide.addShape(pptx.ShapeType.line, {
    x: 0.45,
    y: 6.52,
    w: 12.45,
    h: 0,
    line: { color: C.border, width: 0.75 },
  });
  slide.addShape(pptx.ShapeType.ellipse, {
    x: 0.52,
    y: 6.72,
    w: 0.36,
    h: 0.36,
    fill: { color: C.orange },
    line: { color: C.orange },
  });
  slide.addText('Q', {
    x: 0.52,
    y: 6.77,
    w: 0.36,
    h: 0.2,
    fontFace: FONT_FACE,
    fontSize: 12,
    bold: true,
    color: C.bg,
    align: 'center',
    margin: 0,
  });
  slide.addText('QLEARN', {
    x: 1.02,
    y: 6.78,
    w: 1.0,
    h: 0.18,
    fontFace: FONT_FACE,
    fontSize: 8.5,
    bold: true,
    color: C.navy,
    margin: 0,
  });
  slide.addText('Startup PPT Maker', {
    x: 2.35,
    y: 6.78,
    w: 1.55,
    h: 0.18,
    fontFace: FONT_FACE,
    fontSize: 8.5,
    color: C.footer,
    margin: 0,
    fit: 'shrink',
  });
  slide.addText(safeText(plan.title), {
    x: 4.15,
    y: 6.78,
    w: 4.2,
    h: 0.18,
    fontFace: FONT_FACE,
    fontSize: 8.5,
    color: C.footer,
    margin: 0,
    fit: 'shrink',
  });
  slide.addShape(pptx.ShapeType.ellipse, {
    x: 12.4,
    y: 6.66,
    w: 0.44,
    h: 0.44,
    fill: { color: C.navyDeep },
    line: { color: C.navyDeep },
  });
  slide.addText(String(plan.pageNumber).padStart(2, '0'), {
    x: 12.4,
    y: 6.77,
    w: 0.44,
    h: 0.16,
    fontFace: FONT_FACE,
    fontSize: 9,
    bold: true,
    color: C.bg,
    align: 'center',
    margin: 0,
  });
}

function addImageOnlySlide(slide: PptxSlide, image: GeneratedSlideImage & { imageDataUrl?: string }): void {
  if (!image.imageDataUrl) {
    return;
  }

  slide.addImage({
    data: image.imageDataUrl,
    x: 0,
    y: 0,
    w: SLIDE_W,
    h: SLIDE_H,
  });
}

function createCardDescription(label: string, pageNumber: number): string {
  return safeText(`${label} point ${pageNumber}`);
}

function safeText(value: string): string {
  return stripEllipsis(value).replace(/\s+/g, ' ').trim();
}

async function imageUrlToDataUrl(imageUrl: string): Promise<string> {
  const response = await fetch(imageUrl);
  if (!response.ok) {
    throw new Error(`Failed to load generated slide image: ${response.status}`);
  }

  const blob = await response.blob();
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Failed to convert generated slide image.'));
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        resolve(reader.result);
      } else {
        reject(new Error('Generated slide image conversion returned an invalid result.'));
      }
    };
    reader.readAsDataURL(blob);
  });
}
