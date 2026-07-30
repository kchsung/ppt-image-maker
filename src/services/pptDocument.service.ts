import { supabase } from '@/lib/supabase';
import type {
  GeneratedImageDeck,
  PptDeckPlan,
  PptDocumentEnhancement,
  PptEditableSlideLayout,
  PptEditableTextBlock,
  SlidePlan,
} from '@/types/models/pptMaker.model';
import { getSupabaseFunctionErrorMessage } from '@/utils/supabaseFunctionError';

const SLIDE_W = 13.333;
const SLIDE_H = 7.5;

export async function enhancePptDocument(
  deckPlan: PptDeckPlan,
  imageDeck: GeneratedImageDeck,
): Promise<PptDocumentEnhancement> {
  if (supabase) {
    const { data, error } = await supabase.functions.invoke<PptDocumentEnhancement>('generate-claude-pptx', {
      body: { deckPlan, imageDeck },
    });

    if (error || !data) {
      throw new Error(
        `Native PptxGenJS PPTX generation failed: ${error ? await getSupabaseFunctionErrorMessage(error) : 'No PPTX result returned.'}`,
      );
    }

    if (!data.pptxUrl && data.pptxStatus !== 'processing') {
      throw new Error('Native PptxGenJS PPTX generation completed without an exported PPTX file.');
    }

    return data;
  }

  const layouts: PptEditableSlideLayout[] = [];

  for (const image of imageDeck.images.slice().sort((left, right) => left.pageNumber - right.pageNumber)) {
    const slide = deckPlan.slides.find((candidate) => candidate.id === image.slideId);
    if (!slide) {
      throw new Error(`Slide ${image.pageNumber} is missing its approved copy plan.`);
    }

    layouts.push(createFallbackLayout(slide, Boolean(deckPlan.request.logoImageDataUrl)));
  }

  return {
    title: deckPlan.title,
    fileName: createFileName(deckPlan.title),
    generationMode: 'browser-fallback',
    speakerNotes: layouts.map((layout) => ({
      pageNumber: layout.pageNumber,
      note: layout.qaChecks[0] ?? `Explain the key message of slide ${layout.pageNumber}.`,
    })),
    qaChecklist: [
      'Slide copy was approved before image generation.',
      'Visible editable copy is matched to a verified image layout slot.',
      'Local preview uses generated visual assets because native PptxGenJS PPTX generation requires Supabase.',
      'Main messages remain in speaker notes when there is no dedicated visual slot.',
    ],
    layouts,
    layoutSource: 'fallback',
  };
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
  return [
    { id: 'title', role: 'title', text: slide.title },
    { id: 'subtitle', role: 'subtitle', text: slide.subtitle },
    ...slide.labels.map((label, index) => ({ id: `label-${index + 1}`, role: 'label' as const, text: label })),
    { id: 'takeaway', role: 'takeaway', text: slide.takeaway },
    { id: 'logo', role: 'logo', text: hasLogo ? '' : '로고' },
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
