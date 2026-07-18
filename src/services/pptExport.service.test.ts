import { describe, expect, it } from 'vitest';
import { samplePptMakerRequest } from '@/mocks/pptMaker.mock';
import { enhancePptDocument } from '@/services/pptDocument.service';
import { pptExportService } from '@/services/pptExport.service';
import { pptMakerService } from '@/services/pptMaker.service';

describe('pptExportService', () => {
  it('exports Claude-compatible editable layout blocks into a PPTX blob', async () => {
    const deckPlan = await pptMakerService.generateDeckPlan({ ...samplePptMakerRequest, slideCount: 1 });
    const imageDeck = {
      id: 'image-deck-1',
      deckPlanId: deckPlan.id,
      createdAt: '2026-07-17T00:00:00.000Z',
      images: [
        {
          id: 'image-1',
          slideId: deckPlan.slides[0].id,
          pageNumber: 1,
          title: deckPlan.slides[0].title,
          imageDataUrl:
            'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9WlG9Z8AAAAASUVORK5CYII=',
          prompt: 'Create a visual-only slide image.',
          provider: 'mock' as const,
        },
      ],
    };
    const enhancement = await enhancePptDocument(deckPlan, imageDeck);

    const blob = await pptExportService.createImageDeckBlob(imageDeck, deckPlan, enhancement);

    expect(['application/zip', 'application/vnd.openxmlformats-officedocument.presentationml.presentation']).toContain(blob.type);
    expect(blob.size).toBeGreaterThan(1000);
  });
});
