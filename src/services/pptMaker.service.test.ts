import { describe, expect, it } from 'vitest';
import { samplePptMakerRequest } from '@/mocks/pptMaker.mock';
import { pptMakerService } from '@/services/pptMaker.service';

describe('pptMakerService', () => {
  it('generates a deck plan with slide prompts', async () => {
    const deck = await pptMakerService.generateDeckPlan(samplePptMakerRequest);

    expect(deck.slides).toHaveLength(samplePptMakerRequest.slideCount);
    expect(deck.slides[0].archetype).toBe('cover');
    expect(deck.slides[0].imagePrompt).toContain('Create slide 1');
    expect(deck.slides[0].imagePrompt).toContain('must not contain readable words');
    expect(deck.slides[0].imagePrompt).not.toContain('Required labels');
    expect(deck.slides[0].imagePrompt).toContain(samplePptMakerRequest.audience);
  });

  it('generates mock slide images when Supabase is not configured', async () => {
    const deck = await pptMakerService.generateDeckPlan(samplePptMakerRequest);
    const imageDeck = await pptMakerService.generateSlideImages(deck);

    expect(imageDeck.images).toHaveLength(deck.slides.length);
    expect(imageDeck.images[0].provider).toBe('mock');
    expect(imageDeck.images[0].imageDataUrl).toContain('data:image/svg+xml;base64,');
  });
});
