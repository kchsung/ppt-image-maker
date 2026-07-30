import { describe, expect, it } from 'vitest';
import { samplePptMakerRequest } from '@/mocks/pptMaker.mock';
import { pptMakerService } from '@/services/pptMaker.service';
import { getDeckCopyQaIssues } from '@/utils/pptMaker';

describe('pptMakerService', () => {
  it('generates a deck plan with slide prompts', async () => {
    const deck = await pptMakerService.generateDeckPlan(samplePptMakerRequest);

    expect(deck.slides).toHaveLength(samplePptMakerRequest.slideCount);
    expect(deck.copyQa.status).toBe('passed');
    expect(getDeckCopyQaIssues(deck)).toEqual([]);
    expect(deck.slides[0].archetype).toBe('cover');
    expect(deck.slides.map((slide) => slide.visualStructure)).toEqual([
      'hero-visual',
      'message-emphasis',
      'card-grid',
      'closing-commitment',
    ]);
    expect(deck.slides[0].imagePrompt).toContain('Create one text-free visual asset for presentation slide 1');
    expect(deck.slides[0].imagePrompt).toContain('Required visual structure: hero-visual');
    expect(deck.slides[0].imagePrompt).toContain('text-free visual asset');
    expect(deck.slides[0].imagePrompt).toContain('Do not render readable text');
    expect(deck.slides[0].imageSlot.prompt).toContain('Text-free');
  });

  it('generates mock slide images when Supabase is not configured', async () => {
    const deck = await pptMakerService.generateDeckPlan(samplePptMakerRequest);
    const imageDeck = await pptMakerService.generateSlideImages(deck);

    expect(imageDeck.images).toHaveLength(deck.slides.length);
    expect(imageDeck.images[0].provider).toBe('mock');
    expect(imageDeck.images[0].imageDataUrl).toContain('data:image/svg+xml;base64,');
  });

  it('keeps local Korean demo copy readable and Korean-only', async () => {
    const deck = await pptMakerService.generateDeckPlan({
      ...samplePptMakerRequest,
      targetLanguage: 'Korean',
    });

    expect(deck.copyQa.status).toBe('passed');
    expect(getDeckCopyQaIssues(deck)).toEqual([]);
    expect(deck.slides[0].title).toBe('AI 판단과 실행');
  });
});
