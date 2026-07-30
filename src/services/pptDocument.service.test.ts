import { describe, expect, it } from 'vitest';
import { enhancePptDocument, validateEditableLayout } from '@/services/pptDocument.service';
import type { PptEditableSlideLayout } from '@/types/models/pptMaker.model';
import { samplePptMakerRequest } from '@/mocks/pptMaker.mock';
import { pptMakerService } from '@/services/pptMaker.service';

describe('enhancePptDocument', () => {
  it('creates a Slide JSON-driven HTML/CSS editable layout without an image layer', async () => {
    const deckPlan = await pptMakerService.generateDeckPlan({ ...samplePptMakerRequest, slideCount: 1 });
    const result = await enhancePptDocument(deckPlan);

    expect(result.fileName).toMatch(/\.pptx$/);
    expect(result.speakerNotes[0].pageNumber).toBe(1);
    expect(result.qaChecklist.length).toBeGreaterThan(0);
    expect(result.generationMode).toBe('dom-to-pptx');
    expect(result.layoutSource).toBe('html-css');
    expect(result.layouts[0]?.visualStrategy).toBe('rebuild-with-editables');
    expect(result.layouts[0]?.imageLayer.strategy).toBe('none');
    expect(result.layouts[0]?.textBlocks.map((block) => block.id)).toEqual(
      expect.arrayContaining(['title', 'subtitle', 'main-message', 'takeaway', 'page-number', 'logo']),
    );
  });

  it('accepts only a complete non-overlapping slot layout with approved copy', async () => {
    const deckPlan = await pptMakerService.generateDeckPlan({ ...samplePptMakerRequest, slideCount: 1 });
    const slide = deckPlan.slides[0];
    const textBlocks: PptEditableSlideLayout['textBlocks'] = [
      { id: 'title', role: 'title', text: slide.title, x: 0.8, y: 0.5, w: 7.4, h: 0.7, fontSize: 25, bold: true },
      { id: 'subtitle', role: 'subtitle', text: slide.subtitle, x: 0.8, y: 1.28, w: 7.4, h: 0.35, fontSize: 12 },
      { id: 'objective', role: 'subtitle', text: slide.objective, x: 0.8, y: 1.68, w: 7.4, h: 0.3, fontSize: 10 },
      ...slide.contentBlocks.map((block, index) => ({
        id: `label-${index + 1}`,
        role: 'label' as const,
        text: `${block.heading}\n${block.detail}`,
        x: 0.85 + index * 2.4,
        y: 3.5,
        w: 1.8,
        h: 0.82,
        fontSize: 9,
      })),
      { id: 'takeaway', role: 'takeaway', text: slide.takeaway, x: 1.2, y: 5.65, w: 10.7, h: 0.28, fontSize: 12 },
      { id: 'decision', role: 'takeaway', text: slide.decision, x: 1.2, y: 6.0, w: 10.7, h: 0.28, fontSize: 12 },
      { id: 'logo', role: 'logo', text: '로고', x: 11.62, y: 0.38, w: 1.12, h: 0.34, fontSize: 8 },
    ];
    const layout: PptEditableSlideLayout = {
      pageNumber: 1,
      visualStrategy: 'rebuild-with-editables',
      imageLayer: { strategy: 'full-slide-reference', x: 0, y: 0, w: 13.333, h: 7.5 },
      textBlocks,
      shapes: [],
      qaChecks: [],
      placementConfidence: 95,
    };

    const accepted = validateEditableLayout(layout, slide, false);
    const rejected = validateEditableLayout({
      ...layout,
      textBlocks: layout.textBlocks.map((block) => block.id === 'subtitle' ? { ...block, y: 0.6 } : block),
    }, slide, false);

    expect(accepted.visualStrategy).toBe('rebuild-with-editables');
    expect(accepted.textBlocks).toHaveLength(textBlocks.length);
    expect(rejected.visualStrategy).toBe('image-fallback');
    expect(rejected.textBlocks).toEqual([]);
  });
});
