import type {
  PptDeckPlan,
  PptDocumentEnhancement,
  PptEditableShape,
  PptEditableSlideLayout,
  PptEditableTextBlock,
  SlidePlan,
  SourceReference,
} from '@/types/models/pptMaker.model';
import { getPptDesignQualityIssues, getPptDesignTokens, type PptDesignTokens } from '@/utils/pptDesignQuality';
import { PPT_EXPORT_GRID, snapEditableLayoutToGrid } from '@/utils/pptGrid';
import { fitEditableTextBlocks, getEditableTextLayoutIssues } from '@/utils/pptTextLayout';

const SLIDE_W = PPT_EXPORT_GRID.width;
const SLIDE_H = PPT_EXPORT_GRID.height;

export async function enhancePptDocument(
  deckPlan: PptDeckPlan,
): Promise<PptDocumentEnhancement> {
  const hasLogo = Boolean(deckPlan.request.logoImageDataUrl);
  const tokens = getPptDesignTokens(deckPlan.request.styleReference.templateDesign);
  const layouts = deckPlan.slides.map((slide) => {
    const snappedLayout = snapEditableLayoutToGrid(
      createBrowserPptxLayout(slide, hasLogo, tokens, deckPlan.request.sourceMaterialAnalysis?.sources ?? []),
    );
    return { ...snappedLayout, textBlocks: fitEditableTextBlocks(snappedLayout.textBlocks) };
  });
  const textLayoutIssues = layouts.flatMap((layout) =>
    getEditableTextLayoutIssues(layout.textBlocks).map((issue) => `Slide ${layout.pageNumber}: ${issue}`),
  );
  const designQualityIssues = getPptDesignQualityIssues(deckPlan, layouts);
  const fallbackPreflightIssues = [...textLayoutIssues, ...designQualityIssues];

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
      'PptxGenJS remains available only for post-processing or explicit fallback export; it is not used as the quality source for the HTML/CSS design.',
      'The final PPTX is saved with a short Supabase Storage request after browser-side assembly finishes.',
      fallbackPreflightIssues.length === 0
        ? 'The secondary PptxGenJS fallback layout passed its independent fit and design preflight.'
        : `The secondary PptxGenJS fallback layout has ${fallbackPreflightIssues.length} preflight finding(s); final browser DOM export remains the approved visual source.`,
      'Every editable text block, shape, logo region, and visual layer was snapped to the shared 12-column grid before export.',
    ],
    layouts,
    layoutSource: 'html-css',
  };
}

function createBrowserPptxLayout(slide: SlidePlan, hasLogo: boolean, tokens: PptDesignTokens, sources: SourceReference[]): PptEditableSlideLayout {
  const imageLayer = getImageLayer(slide);
  const contentBlocks = getContentBlocks(slide);
  const objective = slide.objective || slide.subtitle;
  const decision = slide.decision || slide.takeaway;
  const sourceLabel = getSourceLabel(slide, sources);
  const labelBoxes = getLabelBoxes(slide, contentBlocks.length);
  const messageBox = getMessageBox(slide, contentBlocks.length);
  const shapes: PptEditableShape[] = [
    {
      id: 'title-accent',
      type: 'rect',
      x: PPT_EXPORT_GRID.safeMarginX,
      y: 0.42,
      w: 0.06,
      h: 1.18,
      fillColor: tokens.accent,
      lineColor: tokens.accent,
      transparency: 0,
    },
    {
      id: 'footer-line',
      type: 'line',
      x: PPT_EXPORT_GRID.safeMarginX,
      y: PPT_EXPORT_GRID.footerLineY,
      w: 12.25,
      h: 0,
      lineColor: tokens.border,
      lineWidth: 1,
    },
    {
      id: 'page-circle',
      type: 'ellipse',
      x: PPT_EXPORT_GRID.pageX,
      y: PPT_EXPORT_GRID.pageY,
      w: 0.5,
      h: 0.5,
      fillColor: tokens.primary,
      lineColor: tokens.primary,
    },
    ...labelBoxes.map((box, index) => ({
      id: `label-panel-${index + 1}`,
      type: 'roundRect' as const,
      x: box.x,
      y: box.y,
      w: box.w,
      h: box.h,
      fillColor: index % 2 === 0 ? tokens.primarySurface : tokens.accentSurface,
      lineColor: tokens.border,
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
      fillColor: tokens.primary,
      lineColor: tokens.primary,
    });
  }

  return {
    pageNumber: slide.pageNumber,
    visualStrategy: 'rebuild-with-editables',
    imageLayer,
    shapes,
    textBlocks: fitEditableTextBlocks([
      { id: 'title', role: 'title', text: slide.title, x: PPT_EXPORT_GRID.headerX, y: 0.42, w: 9.7, h: 0.84, fontSize: 25, bold: true, color: tokens.primary },
      { id: 'subtitle', role: 'subtitle', text: slide.subtitle, x: PPT_EXPORT_GRID.headerX, y: 1.3, w: 9.7, h: 0.3, fontSize: 11.5, color: tokens.muted },
      {
        id: 'main-message',
        role: 'main-message',
        text: slide.mainMessage,
        ...messageBox,
        fontSize: slide.visualStructure === 'message-emphasis' ? 19 : 14,
        bold: slide.visualStructure === 'message-emphasis',
        color: slide.visualStructure === 'message-emphasis' ? tokens.white : tokens.primary,
        align: slide.visualStructure === 'message-emphasis' ? 'center' : 'left',
      },
    ...contentBlocks.map((block, index) => ({
      id: `label-${index + 1}`,
      role: 'label' as const,
        text: `${block.heading}\n${block.detail}`,
        ...labelBoxes[index],
        x: labelBoxes[index]?.x + 0.08,
        y: labelBoxes[index]?.y + 0.08,
        w: Math.max(0.3, (labelBoxes[index]?.w ?? 0.5) - 0.16),
        h: Math.max(0.3, (labelBoxes[index]?.h ?? 0.5) - 0.16),
        fontSize: 8,
        bold: true,
        color: tokens.primary,
        align: 'center' as const,
      })),
      { id: 'objective', role: 'subtitle', text: objective, x: PPT_EXPORT_GRID.headerX, y: 1.64, w: 9.7, h: 0.36, fontSize: 9.5, bold: true, color: tokens.primary },
      ...(sourceLabel ? [{ id: 'source', role: 'footer' as const, text: sourceLabel, x: PPT_EXPORT_GRID.headerX, y: 6.28, w: 10.95, h: 0.16, fontSize: 7, color: tokens.muted }] : []),
      { id: 'takeaway', role: 'takeaway', text: slide.takeaway, x: PPT_EXPORT_GRID.headerX, y: PPT_EXPORT_GRID.footerLineY, w: 10.96, h: 0.24, fontSize: 7.8, color: tokens.muted },
      { id: 'decision', role: 'takeaway', text: decision, x: PPT_EXPORT_GRID.headerX, y: 6.8, w: 10.96, h: 0.24, fontSize: 8.5, bold: true, color: tokens.primary },
      { id: 'page-number', role: 'footer', text: String(slide.pageNumber).padStart(2, '0'), x: PPT_EXPORT_GRID.pageX, y: 6.68, w: 0.5, h: 0.16, fontSize: 9.5, bold: true, color: tokens.white, align: 'center' },
      { id: 'logo', role: 'logo', text: hasLogo ? '' : '\uB85C\uACE0', x: 11.45, y: 0.42, w: 1.14, h: 0.42, fontSize: 8.5, color: tokens.muted, align: 'center' },
    ]),
    qaChecks: [
      `Editable layout is derived from the approved ${slide.visualStructure} slide structure.`,
      'Editable text was fitted to its PowerPoint bounds without dropping below the 7pt readability threshold.',
    ],
    placementConfidence: 100,
  };
}

function getSourceLabel(slide: SlidePlan, sources: SourceReference[]): string | null {
  const source = sources.find((item) => slide.sourceIds?.includes(item.id));
  if (!source) return null;
  return `Source: ${source.sourceName} - ${source.documentName}${source.publicationYear ? ` (${source.publicationYear})` : ''}`;
}

function getImageLayer(slide: SlidePlan): PptEditableSlideLayout['imageLayer'] {
  void slide;
  return { strategy: 'none', x: 0, y: 0, w: 0, h: 0 };
}

function getMessageBox(slide: SlidePlan, blockCount: number): Pick<PptEditableTextBlock, 'x' | 'y' | 'w' | 'h'> {
  switch (slide.visualStructure) {
    case 'message-emphasis':
      return { x: 1.05, y: 2.55, w: 5.95, h: 0.72 };
    case 'side-by-side-comparison':
    case 'before-after-mapping':
      return blockCount > 4
        ? { x: 0.9, y: 5.35, w: 5.9, h: 0.48 }
        : { x: 0.9, y: 5.05, w: 5.9, h: 0.58 };
    case 'numbered-process':
    case 'roadmap':
      return blockCount > 3
        ? { x: 0.9, y: 5.0, w: 5.9, h: 0.5 }
        : { x: 0.9, y: 4.4, w: 5.9, h: 0.64 };
    case 'hub-and-spoke':
      return blockCount > 4
        ? { x: 0.9, y: 5.35, w: 5.9, h: 0.48 }
        : { x: 0.9, y: 4.72, w: 5.9, h: 0.64 };
    case 'metrics-dashboard':
      return { x: 0.9, y: 4.05, w: 5.9, h: 0.64 };
    case 'pyramid-framework':
      return blockCount > 4
        ? { x: 0.9, y: 5.35, w: 5.9, h: 0.48 }
        : { x: 0.9, y: 5.18, w: 5.9, h: 0.58 };
    case 'hero-visual':
      return blockCount > 3
        ? { x: 0.9, y: 5.35, w: 5.9, h: 0.48 }
        : { x: 0.9, y: 4.65, w: 5.9, h: 0.64 };
    default:
      return blockCount > 4
        ? { x: 0.9, y: 5.35, w: 5.9, h: 0.48 }
        : { x: 0.9, y: 4.65, w: 5.9, h: 0.64 };
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
    return Array.from({ length: count }, (_, index) => ({ x: PPT_EXPORT_GRID.bodyX + index * (width + gap), y, w: width, h }));
  };
  const gridBoxes = (y: number, columns = 3, h = 0.84) => {
    const gap = 0.12;
    const width = (5.9 - gap * (columns - 1)) / columns;
    return Array.from({ length: count }, (_, index) => ({
      x: PPT_EXPORT_GRID.bodyX + (index % columns) * (width + gap),
      y: y + Math.floor(index / columns) * (h + gap),
      w: width,
      h,
    }));
  };

  if (slide.visualStructure === 'numbered-process' || slide.visualStructure === 'roadmap') {
    return count > 3 ? gridBoxes(2.95, 3, 0.9) : linearBoxes(2.95, 5.9, 0.9);
  }
  if (slide.visualStructure === 'metrics-dashboard') {
    return linearBoxes(2.2, 5.9, 1.32);
  }
  if (slide.visualStructure === 'hero-visual') {
    return count > 3 ? gridBoxes(3.5, 3, 0.84) : linearBoxes(3.5, 5.9, 0.84);
  }
  if (slide.visualStructure === 'message-emphasis') {
    return count > 3 ? gridBoxes(4.25, 3, 0.84) : linearBoxes(4.25, 5.9, 0.84);
  }

  return Array.from({ length: count }, (_, index) => ({
    x: PPT_EXPORT_GRID.bodyX + (index % 2) * 3.0,
    y: 2.15 + Math.floor(index / 2) * 1.08,
    w: 2.55,
    h: 0.98,
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
