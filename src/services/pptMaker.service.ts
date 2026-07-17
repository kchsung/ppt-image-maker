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
import {
  createSlideTitle,
  extractKeywords,
  selectArchetype,
  splitIntoSlideSeeds,
  summarizeText,
  validateSlideText,
} from '@/utils/pptMaker';
import { getSupabaseFunctionErrorMessage } from '@/utils/supabaseFunctionError';

function createImagePrompt(request: PptMakerRequest, slide: Omit<SlidePlan, 'imagePrompt'>): string {
  return [
    `Create slide ${slide.pageNumber} visual background for the same presentation deck.`,
    `Style: ${request.styleReference.notes}`,
    `Use ${request.styleReference.primaryColorLabel} as the primary color and ${request.styleReference.accentColorLabel} for emphasis.`,
    `Audience: ${request.audience}`,
    `Purpose: ${request.purpose}`,
    `Language: ${request.targetLanguage}`,
    `Main visual: ${slide.archetype}`,
    `Concepts to represent visually without text: ${slide.labels.join(', ')}`,
    'Editable PPT text will be added later, so the image must not contain readable words.',
    'Do not render titles, labels, body text, footer text, logos, page numbers, captions, or placeholder dots.',
    'Use abstract diagrams, icons, cards, lines, dashboards, or shapes only.',
    'Leave clean whitespace where editable PPT text can be placed later.',
  ].join('\n');
}

export const pptMakerService: PptMakerService = {
  async generateDeckPlan(request) {
    const seeds = splitIntoSlideSeeds(request.sourceText, request.slideCount);
    const totalSlides = seeds.length;

    const slides: SlidePlan[] = seeds.map((seed, index) => {
      const pageNumber = index + 1;
      const archetype = selectArchetype(pageNumber, totalSlides);
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
        mainMessage,
        title,
        subtitle: validateSlideText(subtitle, request.targetLanguage),
        labels,
        takeaway: validateSlideText(takeaway, request.targetLanguage),
      };

      return {
        ...slideWithoutPrompt,
        imagePrompt: createImagePrompt(request, slideWithoutPrompt),
      };
    });

    return {
      id: `deck-${Date.now()}`,
      title: slides[0]?.title ?? 'Untitled Deck',
      createdAt: new Date().toISOString(),
      request,
      slides,
    } satisfies PptDeckPlan;
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

  async generateSlideImages(deckPlan) {
    if (supabase) {
      const job = await this.createGenerationJob(deckPlan);
      const images: GeneratedSlideImage[] = [];

      for (const slide of deckPlan.slides) {
        const item = job?.items.find((jobItem) => jobItem.slideId === slide.id);
        const { data, error } = await supabase.functions.invoke<GeneratedSlideImage>('generate-ppt-image-deck', {
          body: { deckPlan, slide, jobId: job?.id, itemId: item?.id },
        });

        if (error) {
          throw new Error(
            `Slide ${slide.pageNumber} image generation failed: ${await getSupabaseFunctionErrorMessage(error)}`,
          );
        }

        if (!data) {
          throw new Error(`No image returned from Edge Function for slide ${slide.pageNumber}.`);
        }

        images.push(data);
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

function createMockImageDeck(deckPlan: PptDeckPlan): GeneratedImageDeck {
  return {
    id: `image-deck-${Date.now()}`,
    deckPlanId: deckPlan.id,
    createdAt: new Date().toISOString(),
    images: deckPlan.slides.map((slide): GeneratedSlideImage => {
      const svg = createMockSlideSvg(slide);
      return {
        id: `image-${slide.id}`,
        slideId: slide.id,
        pageNumber: slide.pageNumber,
        title: slide.title,
        imageDataUrl: `data:image/svg+xml;base64,${btoa(unescape(encodeURIComponent(svg)))}`,
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
    .map((label, index) => {
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
