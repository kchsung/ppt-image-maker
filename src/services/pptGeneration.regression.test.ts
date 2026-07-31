import { describe, expect, it } from 'vitest';
import JSZip from 'jszip';
import { qlearnStartupServiceIntroductionSource } from '@/mocks/qlearnStartupServiceIntroduction.mock';
import { samplePptMakerRequest } from '@/mocks/pptMaker.mock';
import { enhancePptDocument } from '@/services/pptDocument.service';
import { pptExportService } from '@/services/pptExport.service';
import { pptMakerService } from '@/services/pptMaker.service';
import { getDeckCopyQaIssues } from '@/utils/pptMaker';

const requestedSlideCounts = [10, 20, 30, 50] as const;

describe('QLEARN Startup detailed PPT regression', () => {
  it.each(requestedSlideCounts)(
    'creates a complete editable %i-slide PPTX from the service introduction source',
    async (slideCount) => {
      const deckPlan = await pptMakerService.generateDeckPlan({
        ...samplePptMakerRequest,
        sourceText: qlearnStartupServiceIntroductionSource,
        sourceDocument: {
          name: 'qlearn-for-startup-service-introduction.docx',
          type: 'docx',
          extractedCharacterCount: qlearnStartupServiceIntroductionSource.length,
        },
        topic: 'QLEARN for Startup service introduction',
        audience: 'Startup founders and accelerator operators',
        purpose: 'Explain the product workflow and secure a pilot discussion',
        documentType: 'proposal',
        presentationIntent: 'executive-proposal',
        contentDensity: 'detailed',
        slideCount,
      });

      expect(deckPlan.request.sourceText).toContain('AI 사업성 검토 플랫폼');
      expect(deckPlan.slides).toHaveLength(slideCount);
      const copyIssues = getDeckCopyQaIssues(deckPlan);
      expect(copyIssues.filter((issue) => /empty|placeholder|clipped|editable layout/i.test(issue))).toEqual([]);
      expect(deckPlan.slides.every((slide) =>
        [slide.title, slide.subtitle, slide.objective, slide.mainMessage, slide.decision, slide.takeaway]
          .every((value) => value.trim().length > 0) &&
        slide.contentBlocks.length === 5 &&
        slide.contentBlocks.every((block) => block.heading.trim().length > 0 && block.detail.trim().length > 0),
      )).toBe(true);

      const enhancement = await enhancePptDocument(deckPlan);
      const blob = await pptExportService.createDeckBlob(deckPlan, enhancement);
      const archive = await JSZip.loadAsync(await readBlobAsArrayBuffer(blob));
      const slideXml = await Promise.all(
        Object.keys(archive.files)
          .filter((name) => /^ppt\/slides\/slide\d+\.xml$/u.test(name))
          .map(async (name) => archive.file(name)?.async('string') ?? ''),
      );
      const presentationXml = slideXml.join('\n');

      expect(slideXml).toHaveLength(slideCount + 1);
      expect(presentationXml).toContain('Pretendard');
      expect(presentationXml).not.toMatch(/\.\.\./u);
      expect(blob.size).toBeGreaterThan(10_000);
    },
    90_000,
  );
});

function readBlobAsArrayBuffer(blob: Blob): Promise<ArrayBuffer> {
  if ('arrayBuffer' in blob && typeof blob.arrayBuffer === 'function') {
    return blob.arrayBuffer();
  }

  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as ArrayBuffer);
    reader.onerror = () => reject(reader.error ?? new Error('Unable to read PPTX blob.'));
    reader.readAsArrayBuffer(blob);
  });
}
