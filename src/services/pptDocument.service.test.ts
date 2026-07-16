import { describe, expect, it } from 'vitest';
import { enhancePptDocument } from '@/services/pptDocument.service';
import type { GeneratedImageDeck } from '@/types/models/pptMaker.model';

describe('enhancePptDocument', () => {
  it('creates fallback PPT metadata when Supabase is not configured', async () => {
    const imageDeck: GeneratedImageDeck = {
      id: 'image-deck-1',
      deckPlanId: 'deck-1',
      createdAt: '2026-07-16T00:00:00.000Z',
      images: [
        {
          id: 'image-1',
          slideId: 'slide-1',
          pageNumber: 1,
          title: 'AI Changes Work',
          imageDataUrl: 'data:image/png;base64,AAA',
          prompt: 'Create slide 1',
          provider: 'mock',
        },
      ],
    };

    const result = await enhancePptDocument(imageDeck);

    expect(result.fileName).toMatch(/\.pptx$/);
    expect(result.speakerNotes[0].pageNumber).toBe(1);
    expect(result.qaChecklist.length).toBeGreaterThan(0);
  });
});
