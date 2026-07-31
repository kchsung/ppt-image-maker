import { describe, expect, it } from 'vitest';
import { createLocalPptRequestAnalysis } from '@/utils/pptRequestAnalysis';
import { samplePptMakerRequest } from '@/mocks/pptMaker.mock';

describe('createLocalPptRequestAnalysis', () => {
  it('extracts a lecture duration and recommends a detail-aware slide count', () => {
    const analysis = createLocalPptRequestAnalysis({
      ...samplePptMakerRequest,
      sourceText: 'AI knowledge governance for enterprise teams. This is a 30 minute lecture for new transformation leaders.',
      contentDensity: 'standard',
    });

    expect(analysis.presentationDurationMinutes).toBe(30);
    expect(analysis.slideCount).toBe(17);
    expect(analysis.documentType).toBe('lecture');
    expect(analysis.topic).toContain('AI knowledge governance');
    expect(analysis.clarifyingQuestions).toEqual([]);
  });

  it('keeps the requested slide count when no duration is available', () => {
    const analysis = createLocalPptRequestAnalysis({ ...samplePptMakerRequest, slideCount: 42 });

    expect(analysis.presentationDurationMinutes).toBeNull();
    expect(analysis.slideCount).toBe(42);
    expect(analysis.clarifyingQuestions).toContainEqual(expect.objectContaining({ id: 'duration', required: true }));
  });

  it('registers uploaded documents and URLs as reusable source records', () => {
    const analysis = createLocalPptRequestAnalysis({
      ...samplePptMakerRequest,
      sourceText: 'The latest report is available at https://example.com/reports/2025.',
      sourceAttachments: [{ id: 'report', name: 'industry-report-2024.pdf', type: 'pdf', extractedCharacterCount: 200, tableCount: 0, imageCount: 0 }],
    });

    expect(analysis.sourceMaterialAnalysis.sources).toEqual(expect.arrayContaining([
      expect.objectContaining({ documentName: 'industry-report-2024.pdf', publicationYear: 2024 }),
      expect.objectContaining({ sourceName: 'example.com', url: 'https://example.com/reports/2025' }),
    ]));
  });
});
