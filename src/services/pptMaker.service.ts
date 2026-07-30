import type { PptMakerService } from '@/interfaces/pptMaker.interface';
import { supabase } from '@/lib/supabase';
import type {
  GeneratedImageDeck,
  GeneratedSlideImage,
  GenerationJob,
  PptDeckPlan,
  PptMakerRequest,
  SlidePlan,
} from '@/types/models/pptMaker.model';
import { createMockDeckPlan, createMockSlideImageDataUrl } from '@/mocks/pptMaker.mock';
import {
  createSlideTitle,
  extractKeywords,
  getDeckCopyQaIssues,
  getVisualStructureDescription,
  selectArchetype,
  selectVisualStructure,
  splitIntoSlideSeeds,
  summarizeText,
  validateSlideText,
} from '@/utils/pptMaker';
import { getSupabaseFunctionErrorMessage } from '@/utils/supabaseFunctionError';

function createImagePrompt(request: PptMakerRequest, slide: Omit<SlidePlan, 'imagePrompt'>): string {
  return [
    `Create one text-free visual asset for presentation slide ${slide.pageNumber}.`,
    `Style: ${request.styleReference.notes}`,
    `Use ${request.styleReference.primaryColorLabel} as the primary color and ${request.styleReference.accentColorLabel} for emphasis.`,
    `Story role: ${slide.archetype}.`,
    `Required visual structure: ${slide.visualStructure}.`,
    `Composition instruction: ${getVisualStructureDescription(slide.visualStructure)}`,
    `Image slot purpose: ${slide.imageSlot.purpose}.`,
    `Place the asset for a ${slide.imageSlot.placement} slot only.`,
    slide.imageSlot.prompt,
    `Concepts to represent visually: ${slide.labels.join(', ')}.`,
    `Slide concept: ${slide.mainMessage}`,
    'Return only the illustration, photo treatment, icon system, or diagram asset. Do not make a full 16:9 slide.',
    'Do not render readable text, letters, numbers, labels, titles, subtitles, logos, page numbers, footers, cards, arrows, frames, or placeholders.',
    'The PptxGenJS renderer will create every text box, metric, card, connector, and logo position as editable native PowerPoint objects.',
  ].join('\n');
}

export const pptMakerService: PptMakerService = {
  async generateDeckPlan(request) {
    if (supabase) {
      const { data, error } = await supabase.functions.invoke<PptDeckPlan>('generate-ppt-slide-plan', {
        body: { request },
      });

      if (error) {
        throw new Error(`Slide copy planning failed: ${await getSupabaseFunctionErrorMessage(error)}`);
      }

      if (!data) {
        throw new Error('Slide copy planning returned no deck plan.');
      }

      const plan = {
        ...data,
        id: data.id || `deck-${Date.now()}`,
        createdAt: data.createdAt || new Date().toISOString(),
        request,
      } satisfies PptDeckPlan;
      const issues = getDeckCopyQaIssues(plan);
      if (issues.length > 0 || plan.copyQa.status !== 'passed') {
        throw new Error(issues[0] ?? plan.copyQa.issues[0] ?? 'Slide copy did not pass quality validation.');
      }

      return {
        ...plan,
        slides: plan.slides.map((slide) => ({
          ...slide,
          imagePrompt: createImagePrompt(request, slide),
        })),
      };
    }

    return createLocalDemoDeckPlan(request);
  },

  async createGenerationJob(deckPlan) {
    if (!supabase) {
      return null;
    }

    const { data, error } = await supabase.functions.invoke<GenerationJob>('create-ppt-generation-job', {
      body: { deckPlan },
    });

    if (error) {
      throw new Error(`PPT generation job registration failed: ${await getSupabaseFunctionErrorMessage(error)}`);
    }

    if (!data) {
      throw new Error('No generation job returned from Edge Function.');
    }

    return data;
  },

  async generateSlideImages(deckPlan, onSlideGenerated) {
    if (supabase) {
      const job = await this.createGenerationJob(deckPlan);
      const images: GeneratedSlideImage[] = [];

      for (const slide of deckPlan.slides) {
        const item = job?.items.find((jobItem) => jobItem.slideId === slide.id);
        const data = await generateSlideWithRateLimitRetry(deckPlan, slide, job?.id, item?.id);

        if (!data) {
          throw new Error(`No image returned from Edge Function for slide ${slide.pageNumber}.`);
        }

        images.push(data);
        onSlideGenerated?.(data);
      }

      return {
        id: job?.id ? `image-deck-${job.id}` : `image-deck-${Date.now()}`,
        deckPlanId: deckPlan.id,
        generationJobId: job?.id,
        createdAt: new Date().toISOString(),
        images,
      };
    }

    return createMockImageDeck(deckPlan);
  },
};

async function generateSlideWithRateLimitRetry(
  deckPlan: PptDeckPlan,
  slide: SlidePlan,
  jobId?: string,
  itemId?: string,
): Promise<GeneratedSlideImage | null> {
  if (!supabase) return null;

  for (let attempt = 0; attempt < 3; attempt += 1) {
    const { data, error } = await supabase.functions.invoke<GeneratedSlideImage>('generate-ppt-image-deck', {
      body: { deckPlan, slide, jobId, itemId },
    });
    if (!error) return data ?? null;

    const message = await getSupabaseFunctionErrorMessage(error);
    const retryAfterSeconds = getImageRetryAfterSeconds(message);
    if (retryAfterSeconds && attempt < 2) {
      await wait(retryAfterSeconds * 1_000);
      continue;
    }
    throw new Error(`Slide ${slide.pageNumber} image generation failed: ${message}`);
  }

  return null;
}

function getImageRetryAfterSeconds(message: string): number | null {
  const match = message.match(/retry after\s+(\d+)\s+seconds/iu) ?? message.match(/try again in\s+(\d+)s/iu);
  return match ? Math.max(1, Number(match[1])) : null;
}

function wait(durationMs: number): Promise<void> {
  return new Promise((resolve) => window.setTimeout(resolve, durationMs));
}

function createLocalDemoDeckPlan(request: PptMakerRequest): PptDeckPlan {
  const plan = createMockDeckPlan(request, {
    id: `deck-${Date.now()}`,
    createdAt: new Date().toISOString(),
  });

  return {
    ...plan,
    slides: plan.slides.map((slide) => ({
      ...slide,
      imagePrompt: createImagePrompt(request, slide),
    })),
  };
}

function createLegacyLocalDemoDeckPlan(request: PptMakerRequest): PptDeckPlan {
    const seeds = splitIntoSlideSeeds(request.sourceText, request.slideCount);
    const totalSlides = seeds.length;

    const slides: SlidePlan[] = seeds.map((seed, index) => {
      const pageNumber = index + 1;
      const archetype = selectArchetype(pageNumber, totalSlides);
      const visualStructure = selectVisualStructure(pageNumber, totalSlides, archetype);
      const rawLabels = extractKeywords(seed, archetype === 'cover' ? 3 : 5);
      const labels = rawLabels.map((label) => validateSlideText(label, request.targetLanguage)).filter(Boolean);
      const mainMessage = validateSlideText(summarizeText(seed, 140), request.targetLanguage);
      const title = validateSlideText(createSlideTitle(seed, request.targetLanguage, pageNumber), request.targetLanguage);
      const subtitle =
        request.targetLanguage === 'Korean'
          ? `${request.audience} 대상 ${request.purpose} 발표 자료`
          : `Designed for ${request.audience} in a ${request.purpose}.`;
      const takeaway =
        request.targetLanguage === 'Korean'
          ? `${labels[0] ?? '핵심'}을 실행 가능한 판단 기준으로 연결합니다.`
          : `Turn ${labels[0] ?? 'the idea'} into a clear decision the audience can remember.`;

      const slideWithoutPrompt: Omit<SlidePlan, 'imagePrompt'> = {
        id: `slide-${pageNumber}`,
        pageNumber,
        archetype,
        visualStructure,
        mainMessage,
        title,
        subtitle: validateSlideText(subtitle, request.targetLanguage),
        labels,
        takeaway: validateSlideText(takeaway, request.targetLanguage),
        imageSlot: {
          id: `visual-${pageNumber}`,
          purpose: 'A supporting editorial illustration for the editable slide layout.',
          placement: 'right-hero',
          prompt: `Text-free editorial illustration representing ${labels.join(', ')}.`,
        },
      };

      return {
        ...slideWithoutPrompt,
        imagePrompt: createImagePrompt(request, slideWithoutPrompt),
      };
    });

    const plan = {
      id: `deck-${Date.now()}`,
      title: slides[0]?.title ?? 'Untitled Deck',
      createdAt: new Date().toISOString(),
      request,
      slides,
      copyQa: { status: 'needs-review', checks: ['Local demo fallback only.'], issues: [] },
    } satisfies PptDeckPlan;

    return plan;
}

function createMockImageDeck(deckPlan: PptDeckPlan): GeneratedImageDeck {
  return {
    id: `image-deck-${Date.now()}`,
    deckPlanId: deckPlan.id,
    createdAt: new Date().toISOString(),
    images: deckPlan.slides.map((slide): GeneratedSlideImage => {
      return {
        id: `image-${slide.id}`,
        slideId: slide.id,
        pageNumber: slide.pageNumber,
        title: slide.title,
        imageDataUrl: createMockSlideImageDataUrl(slide),
        prompt: slide.imagePrompt,
        provider: 'mock',
      };
    }),
  };
}

function createMockSlideSvg(slide: SlidePlan): string {
  const labels = slide.labels.slice(0, 4);
  const cardWidth = 330;
  const cardGap = 24;
  const startX = 90;
  const cards = labels
    .map((_, index) => {
      const x = startX + index * (cardWidth + cardGap);
      return `
        <rect x="${x}" y="500" width="${cardWidth}" height="210" rx="18" fill="${index % 2 === 0 ? '#EFF5FE' : '#FEF7EE'}"/>
        <rect x="${x + 28}" y="540" width="72" height="72" rx="36" fill="#FFFFFF"/>
        <circle cx="${x + 64}" cy="576" r="18" fill="${index % 2 === 0 ? '#0B2454' : '#FE6621'}" opacity="0.86"/>
      `;
    })
    .join('');

  return `
    <svg xmlns="http://www.w3.org/2000/svg" width="1920" height="1080" viewBox="0 0 1920 1080">
      <rect width="1920" height="1080" fill="#FFFFFF"/>
      <rect x="88" y="92" width="12" height="150" rx="6" fill="#FE6621"/>
      <circle cx="1470" cy="470" r="210" fill="#EFF5FE" stroke="#0B2454" stroke-width="6" opacity="0.65"/>
      <path d="M280 760 H1580" stroke="#0B2454" stroke-width="8" opacity="0.55"/>
      ${cards}
      <rect x="90" y="900" width="1620" height="90" rx="45" fill="#FFFFFF" stroke="#0B2454" stroke-width="3"/>
      <circle cx="1800" cy="945" r="42" fill="#0B2454"/>
    </svg>
  `;
}
