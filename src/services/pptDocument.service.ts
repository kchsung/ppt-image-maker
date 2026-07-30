import type {
  PptDeckPlan,
  PptDocumentEnhancement,
  PptEditableShape,
  PptEditableSlideLayout,
  PptEditableTextBlock,
  SlidePlan,
} from '@/types/models/pptMaker.model';

const SLIDE_W = 13.333;
const SLIDE_H = 7.5;

export async function enhancePptDocument(
  deckPlan: PptDeckPlan,
): Promise<PptDocumentEnhancement> {
  const hasLogo = Boolean(deckPlan.request.logoImageDataUrl);
  const layouts = deckPlan.slides.map((slide) => createBrowserPptxLayout(slide, hasLogo));

  return {
    title: deckPlan.title,
    fileName: createFileName(deckPlan.title),
    generationMode: 'dom-to-pptx',
    speakerNotes: layouts.map((layout) => ({
      pageNumber: layout.pageNumber,
      note: layout.qaChecks[0] ?? `Explain the key message of slide ${layout.pageNumber}.`,
    })),
    qaChecklist: [
      'Slide copy was approved before layout rendering.',
      'The layout engine selected a visual structure for every approved Slide JSON record.',
      'HTML/CSS is the preview source and dom-to-pptx converts the same text, cards, connectors, and diagrams into editable PowerPoint objects.',
      'PptxGenJS remains available for post-processing and browser fallback export.',
      'The final PPTX is saved with a short Supabase Storage request after browser-side assembly finishes.',
    ],
    layouts,
    layoutSource: 'html-css',
  };
}

function createBrowserPptxLayout(slide: SlidePlan, hasLogo: boolean): PptEditableSlideLayout {
  const imageLayer = getImageLayer(slide);
  const contentBlocks = getContentBlocks(slide);
  const objective = slide.objective || slide.subtitle;
  const decision = slide.decision || slide.takeaway;
  const labelBoxes = getLabelBoxes(slide, contentBlocks.length);
  const messageBox = getMessageBox(slide);
  const shapes: PptEditableShape[] = [
    {
      id: 'title-accent',
      type: 'rect',
      x: 0.52,
      y: 0.52,
      w: 0.06,
      h: 1.2,
      fillColor: 'FE6621',
      lineColor: 'FE6621',
      transparency: 0,
    },
    {
      id: 'footer-line',
      type: 'line',
      x: 0.52,
      y: 6.52,
      w: 12.25,
      h: 0,
      lineColor: 'D8E1EF',
      lineWidth: 1,
    },
    {
      id: 'page-circle',
      type: 'ellipse',
      x: 12.15,
      y: 6.57,
      w: 0.5,
      h: 0.5,
      fillColor: '0B2454',
      lineColor: '0B2454',
    },
    ...labelBoxes.map((box, index) => ({
      id: `label-panel-${index + 1}`,
      type: 'roundRect' as const,
      x: box.x,
      y: box.y,
      w: box.w,
      h: box.h,
      fillColor: index % 2 === 0 ? 'F3F6FB' : 'FFF7EE',
      lineColor: 'D8E1EF',
      lineWidth: 0.8,
    })),
  ];

  if (slide.visualStructure === 'message-emphasis') {
    shapes.push({
      id: 'message-emphasis-panel',
      type: 'roundRect',
      x: messageBox.x - 0.12,
      y: messageBox.y - 0.14,
      w: messageBox.w + 0.24,
      h: messageBox.h + 0.28,
      fillColor: '0B2454',
      lineColor: '0B2454',
    });
  }

  return {
    pageNumber: slide.pageNumber,
    visualStrategy: 'rebuild-with-editables',
    imageLayer,
    shapes,
    textBlocks: [
      { id: 'title', role: 'title', text: slide.title, x: 0.76, y: 0.5, w: 8.8, h: 0.48, fontSize: 25, bold: true, color: '0B2454' },
      { id: 'subtitle', role: 'subtitle', text: slide.subtitle, x: 0.76, y: 1.03, w: 8.8, h: 0.32, fontSize: 11.5, color: '5F6F89' },
      {
        id: 'main-message',
        role: 'main-message',
        text: slide.mainMessage,
        ...messageBox,
        fontSize: slide.visualStructure === 'message-emphasis' ? 19 : 14,
        bold: slide.visualStructure === 'message-emphasis',
        color: slide.visualStructure === 'message-emphasis' ? 'FFFFFF' : '18253D',
        align: slide.visualStructure === 'message-emphasis' ? 'center' : 'left',
      },
    ...contentBlocks.map((block, index) => ({
      id: `label-${index + 1}`,
      role: 'label' as const,
        text: `${block.heading}\n${block.detail}`,
        ...labelBoxes[index],
        x: labelBoxes[index]?.x + 0.08,
        y: labelBoxes[index]?.y + Math.max(0.12, labelBoxes[index]?.h * 0.3),
        w: Math.max(0.3, (labelBoxes[index]?.w ?? 0.5) - 0.16),
        h: Math.max(0.18, (labelBoxes[index]?.h ?? 0.5) * 0.44),
        fontSize: 8.5,
        bold: true,
        color: '0B2454',
        align: 'center' as const,
      })),
      { id: 'objective', role: 'subtitle', text: objective, x: 0.76, y: 1.35, w: 8.8, h: 0.26, fontSize: 9.5, bold: true, color: '0B2454' },
      { id: 'takeaway', role: 'takeaway', text: slide.takeaway, x: 0.76, y: 6.56, w: 10.95, h: 0.16, fontSize: 7.8, color: '5F6F89' },
      { id: 'decision', role: 'takeaway', text: decision, x: 0.76, y: 6.8, w: 10.95, h: 0.18, fontSize: 8.5, bold: true, color: '0B2454' },
      { id: 'page-number', role: 'footer', text: String(slide.pageNumber).padStart(2, '0'), x: 12.15, y: 6.69, w: 0.5, h: 0.16, fontSize: 9.5, bold: true, color: 'FFFFFF', align: 'center' },
      { id: 'logo', role: 'logo', text: hasLogo ? '' : '\uB85C\uACE0', x: 11.45, y: 0.42, w: 1.14, h: 0.42, fontSize: 8.5, color: '85878A', align: 'center' },
    ],
    qaChecks: [`Editable layout is derived from the approved ${slide.visualStructure} slide structure.`],
    placementConfidence: 100,
  };
}

function getImageLayer(slide: SlidePlan): PptEditableSlideLayout['imageLayer'] {
  void slide;
  return { strategy: 'none', x: 0, y: 0, w: 0, h: 0 };
}

function getMessageBox(slide: SlidePlan): Pick<PptEditableTextBlock, 'x' | 'y' | 'w' | 'h'> {
  switch (slide.visualStructure) {
    case 'message-emphasis':
      return { x: 1.05, y: 2.55, w: 5.95, h: 0.72 };
    case 'side-by-side-comparison':
    case 'before-after-mapping':
      return { x: 0.9, y: 5.05, w: 5.9, h: 0.58 };
    case 'numbered-process':
    case 'roadmap':
      return { x: 0.9, y: 4.4, w: 5.9, h: 0.64 };
    case 'hub-and-spoke':
      return { x: 0.9, y: 4.72, w: 5.9, h: 0.64 };
    case 'metrics-dashboard':
      return { x: 0.9, y: 4.05, w: 5.9, h: 0.64 };
    case 'pyramid-framework':
      return { x: 0.9, y: 5.18, w: 5.9, h: 0.58 };
    default:
      return { x: 0.9, y: 4.65, w: 5.9, h: 0.64 };
  }
}

function getContentBlocks(slide: SlidePlan): Array<{ heading: string; detail: string }> {
  return slide.contentBlocks?.length > 0
    ? slide.contentBlocks
    : slide.labels.map((heading) => ({ heading, detail: slide.mainMessage }));
}

function getLabelBoxes(slide: SlidePlan, blockCount: number): Array<Pick<PptEditableTextBlock, 'x' | 'y' | 'w' | 'h'>> {
  const count = Math.max(1, blockCount);
  const linearBoxes = (y: number, availableWidth = 5.9, h = 0.66) => {
    const gap = 0.12;
    const width = (availableWidth - gap * (count - 1)) / count;
    return Array.from({ length: count }, (_, index) => ({ x: 0.86 + index * (width + gap), y, w: width, h }));
  };

  if (slide.visualStructure === 'numbered-process' || slide.visualStructure === 'roadmap') {
    return linearBoxes(2.95, 5.9, 0.74);
  }
  if (slide.visualStructure === 'metrics-dashboard') {
    return linearBoxes(2.2, 5.9, 1.32);
  }
  if (slide.visualStructure === 'hero-visual') {
    return linearBoxes(3.5, 5.9, 0.62);
  }
  if (slide.visualStructure === 'message-emphasis') {
    return linearBoxes(4.25, 5.9, 0.58);
  }

  return Array.from({ length: count }, (_, index) => ({
    x: 0.86 + (index % 2) * 3.0,
    y: 2.15 + Math.floor(index / 2) * 1.08,
    w: 2.55,
    h: 0.83,
  }));
}

export function createFallbackLayout(slide: SlidePlan, _hasLogo: boolean): PptEditableSlideLayout {
  return {
    pageNumber: slide.pageNumber,
    visualStrategy: 'image-fallback',
    imageLayer: { strategy: 'full-slide-fallback', x: 0, y: 0, w: SLIDE_W, h: SLIDE_H },
    shapes: [],
    textBlocks: [],
    qaChecks: ['The editable layout was not verified, so the source slide image is preserved without overlay text.'],
    placementConfidence: 0,
  };
}

export function validateEditableLayout(
  layout: PptEditableSlideLayout,
  slide: SlidePlan,
  hasLogo: boolean,
): PptEditableSlideLayout {
  if (layout.visualStrategy === 'image-fallback' || (layout.placementConfidence ?? 0) < 85) {
    return createFallbackLayout(slide, hasLogo);
  }

  const expected = createExpectedBlocks(slide, hasLogo);
  const resolvedBlocks = expected.map((target) => {
    const candidate = layout.textBlocks.find((block) => block.id === target.id);
    return candidate && candidate.role === target.role && candidate.text === target.text ? candidate : null;
  }).filter(Boolean) as PptEditableTextBlock[];

  if (
    resolvedBlocks.length !== expected.length ||
    !blocksStayWithinSlide(resolvedBlocks) ||
    blocksOverlap(resolvedBlocks)
  ) {
    return createFallbackLayout(slide, hasLogo);
  }

  return {
    ...layout,
    imageLayer: { strategy: 'full-slide-reference', x: 0, y: 0, w: SLIDE_W, h: SLIDE_H },
    shapes: [],
    textBlocks: resolvedBlocks,
    qaChecks: [...layout.qaChecks, 'Validated approved copy against non-overlapping image layout slots.'],
  };
}

function createExpectedBlocks(
  slide: SlidePlan,
  hasLogo: boolean,
): Array<Pick<PptEditableTextBlock, 'id' | 'role' | 'text'>> {
  const objective = slide.objective || slide.subtitle;
  const decision = slide.decision || slide.takeaway;

  return [
    { id: 'title', role: 'title', text: slide.title },
    { id: 'subtitle', role: 'subtitle', text: slide.subtitle },
    { id: 'objective', role: 'subtitle', text: objective },
    ...getContentBlocks(slide).map((block, index) => ({ id: `label-${index + 1}`, role: 'label' as const, text: `${block.heading}\n${block.detail}` })),
    { id: 'takeaway', role: 'takeaway', text: slide.takeaway },
    { id: 'decision', role: 'takeaway', text: decision },
    { id: 'logo', role: 'logo', text: hasLogo ? '' : '\uB85C\uACE0' },
  ];
}

function blocksStayWithinSlide(blocks: PptEditableTextBlock[]): boolean {
  return blocks.every((block) => (
    block.x >= 0 &&
    block.y >= 0 &&
    block.w >= 0.2 &&
    block.h >= 0.12 &&
    block.x + block.w <= SLIDE_W &&
    block.y + block.h <= SLIDE_H &&
    block.fontSize >= 6 &&
    block.fontSize <= 42
  ));
}

function blocksOverlap(blocks: PptEditableTextBlock[]): boolean {
  return blocks.some((block, index) => blocks.slice(index + 1).some((candidate) => {
    const overlapsHorizontally = block.x < candidate.x + candidate.w && candidate.x < block.x + block.w;
    const overlapsVertically = block.y < candidate.y + candidate.h && candidate.y < block.y + block.h;
    return overlapsHorizontally && overlapsVertically;
  }));
}

function createFileName(title: string): string {
  const safeName = title
    .replace(/[\\/:*?"<>|]/g, '')
    .replace(/\s+/g, '-')
    .slice(0, 64)
    .replace(/^-|-$/g, '');
  return `${safeName || 'qlearn-editable-deck'}.pptx`;
}
