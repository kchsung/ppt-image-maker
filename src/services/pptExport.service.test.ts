import { describe, expect, it } from 'vitest';
import { samplePptMakerRequest } from '@/mocks/pptMaker.mock';
import { enhancePptDocument } from '@/services/pptDocument.service';
import { pptExportService } from '@/services/pptExport.service';
import { pptMakerService } from '@/services/pptMaker.service';

describe('pptExportService', () => {
  it('exports editable layout blocks into a PPTX blob through the PptxGenJS fallback', async () => {
    const deckPlan = await pptMakerService.generateDeckPlan({ ...samplePptMakerRequest, slideCount: 1 });
    const enhancement = await enhancePptDocument(deckPlan);

    const blob = await pptExportService.createDeckBlob(deckPlan, enhancement);

    expect(['application/zip', 'application/vnd.openxmlformats-officedocument.presentationml.presentation']).toContain(blob.type);
    expect(blob.size).toBeGreaterThan(1000);
  });
});
