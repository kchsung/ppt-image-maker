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
} from '@/utils/pptMaker';

function createImagePrompt(request: PptMakerRequest, slide: Omit<SlidePlan, 'imagePrompt'>): string {
  return [
    `Create slide ${slide.pageNumber} of the same presentation deck.`,
    `Style: ${request.styleReference.notes}`,
    `Use ${request.styleReference.primaryColorLabel} as the primary color and ${request.styleReference.accentColorLabel} for emphasis.`,
    `Audience: ${request.audience}`,
    `Purpose: ${request.purpose}`,
    `Language: ${request.targetLanguage}`,
    `Main message: ${slide.mainMessage}`,
    `Title: "${slide.title}"`,
    `Subtitle: "${slide.subtitle}"`,
    `Main visual: ${slide.archetype}`,
    `Required labels: ${slide.labels.join(', ')}`,
    `Bottom takeaway: "${slide.takeaway}"`,
    'Keep text readable. Do not add unrelated text. Preserve page number and footer consistency.',
  ].join('\n');
}

export const pptMakerService: PptMakerService = {
  async generateDeckPlan(request) {
    const seeds = splitIntoSlideSeeds(request.sourceText, request.slideCount);
    const totalSlides = seeds.length;

    const slides: SlidePlan[] = seeds.map((seed, index) => {
      const pageNumber = index + 1;
      const archetype = selectArchetype(pageNumber, totalSlides);
      const labels = extractKeywords(seed, archetype === 'cover' ? 3 : 5);
      const mainMessage = summarizeText(seed, 140);
      const title = createSlideTitle(seed, request.targetLanguage, pageNumber);
      const subtitle =
        request.targetLanguage === 'Korean'
          ? `${request.audience} 대상 ${request.purpose} 장표`
          : `Designed for ${request.audience} in a ${request.purpose}.`;
      const takeaway =
        request.targetLanguage === 'Korean'
          ? `${labels[0] ?? '핵심'}을 실행 가능한 판단으로 연결합니다.`
          : `Turn ${labels[0] ?? 'the idea'} into a clear decision the audience can remember.`;

      const slideWithoutPrompt: Omit<SlidePlan, 'imagePrompt'> = {
        id: `slide-${pageNumber}`,
        pageNumber,
        archetype,
        mainMessage,
        title,
        subtitle,
        labels,
        takeaway,
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
      throw new Error(`PPT generation job registration failed: ${error.message}`);
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
          throw new Error(`Slide ${slide.pageNumber} image generation failed: ${error.message}`);
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
        <text x="${x + 28}" y="570" font-size="34" font-weight="700" fill="#0B2454">${escapeXml(label)}</text>
        <rect x="${x + 28}" y="598" width="70" height="8" rx="4" fill="#FE6621"/>
        <text x="${x + 28}" y="660" font-size="22" fill="#333333">Presentation-ready point</text>
      `;
    })
    .join('');

  return `
    <svg xmlns="http://www.w3.org/2000/svg" width="1920" height="1080" viewBox="0 0 1920 1080">
      <rect width="1920" height="1080" fill="#FFFFFF"/>
      <rect x="88" y="92" width="12" height="150" rx="6" fill="#FE6621"/>
      <text x="130" y="150" font-family="Arial, sans-serif" font-size="58" font-weight="700" fill="#0B2454">${escapeXml(slide.title)}</text>
      <text x="130" y="220" font-family="Arial, sans-serif" font-size="28" fill="#6B7280">${escapeXml(slide.subtitle)}</text>
      <text x="130" y="340" font-family="Arial, sans-serif" font-size="32" fill="#333333">${escapeXml(slide.mainMessage)}</text>
      ${cards}
      <rect x="90" y="900" width="1620" height="90" rx="45" fill="#FFFFFF" stroke="#0B2454" stroke-width="3"/>
      <text x="140" y="956" font-family="Arial, sans-serif" font-size="28" font-weight="700" fill="#0B2454">${escapeXml(slide.takeaway)}</text>
      <circle cx="1800" cy="945" r="42" fill="#0B2454"/>
      <text x="1800" y="960" text-anchor="middle" font-family="Arial, sans-serif" font-size="30" font-weight="700" fill="#FFFFFF">${slide.pageNumber}</text>
    </svg>
  `;
}

function escapeXml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}
