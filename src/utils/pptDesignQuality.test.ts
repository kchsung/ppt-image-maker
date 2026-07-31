import { describe, expect, it } from 'vitest';
import { enhancePptDocument } from '@/services/pptDocument.service';
import { samplePptMakerRequest } from '@/mocks/pptMaker.mock';
import { getTemplateDesignProfile } from '@/mocks/pptTemplates.mock';
import { pptMakerService } from '@/services/pptMaker.service';
import { getContrastRatio, getPptDesignQualityIssues } from '@/utils/pptDesignQuality';
import { getPptGridAlignmentIssues, PPT_EXPORT_GRID } from '@/utils/pptGrid';

describe('ppt design quality', () => {
  it('validates the visual hierarchy, template palette, safe areas, and proof panels', async () => {
    const deckPlan = await pptMakerService.generateDeckPlan({ ...samplePptMakerRequest, slideCount: 6 });
    const enhancement = await enhancePptDocument(deckPlan);

    expect(getPptDesignQualityIssues(deckPlan, enhancement.layouts)).toEqual([]);
  });

  it('reports low contrast and missing design hierarchy', async () => {
    const deckPlan = await pptMakerService.generateDeckPlan({
      ...samplePptMakerRequest,
      slideCount: 1,
      styleReference: {
        ...samplePptMakerRequest.styleReference,
        templateDesign: {
          primaryColor: '#F5F5F5',
          accentColor: '#F5F5F5',
          primarySurfaceColor: '#FFFFFF',
          accentSurfaceColor: '#FFFFFF',
          signatureLayout: 'low contrast fixture',
          recommendedVisualStructures: ['roadmap'],
        },
      },
    });
    const enhancement = await enhancePptDocument({
      ...deckPlan,
      request: samplePptMakerRequest,
    });
    const invalidLayout = {
      ...enhancement.layouts[0],
      textBlocks: enhancement.layouts[0].textBlocks.map((block) => block.id === 'title'
        ? { ...block, fontSize: 12, x: 0.1 }
        : block),
    };

    const issues = getPptDesignQualityIssues(deckPlan, [invalidLayout]);

    expect(issues).toEqual(expect.arrayContaining([
      expect.stringContaining('contrast'),
      expect.stringContaining('separate primary and accent'),
      expect.stringContaining('typography hierarchy'),
      expect.stringContaining('safe area'),
      expect.stringContaining('visual direction needs'),
    ]));
    expect(getContrastRatio('0B2454', 'FFFFFF')).toBeGreaterThan(4.5);
  });

  it('carries a selected template palette into the editable PPT layout', async () => {
    const templateDesign = getTemplateDesignProfile('template-13');
    const deckPlan = await pptMakerService.generateDeckPlan({
      ...samplePptMakerRequest,
      slideCount: 4,
      styleReference: {
        ...samplePptMakerRequest.styleReference,
        templateDesign,
      },
    });
    const enhancement = await enhancePptDocument(deckPlan);
    const firstLayout = enhancement.layouts[0];

    expect(firstLayout.textBlocks.find((block) => block.id === 'title')?.color).toBe('252A34');
    expect(firstLayout.shapes.find((shape) => shape.id === 'title-accent')?.fillColor).toBe('D78B00');
    expect(firstLayout.shapes.find((shape) => shape.id === 'label-panel-1')?.fillColor).toBe('FFF8ED');
    expect(getPptDesignQualityIssues(deckPlan, enhancement.layouts)).toEqual([]);
  });

  it('snaps all editable text, shapes, and image layers to the shared 12-column PPT grid', async () => {
    const deckPlan = await pptMakerService.generateDeckPlan({ ...samplePptMakerRequest, slideCount: 1 });
    const enhancement = await enhancePptDocument(deckPlan);
    const layout = enhancement.layouts[0];
    const misalignedLayout = {
      ...layout,
      textBlocks: layout.textBlocks.map((block) => block.id === 'title' ? { ...block, x: block.x + 0.01 } : block),
    };

    expect(PPT_EXPORT_GRID.columnCount).toBe(12);
    expect(getPptGridAlignmentIssues(layout)).toEqual([]);
    expect(getPptGridAlignmentIssues(misalignedLayout)).toContain('object "title" is not aligned to the shared PPT grid.');
  });

  it('flags incomplete structured visual data before it can reach the editable layout', async () => {
    const deckPlan = await pptMakerService.generateDeckPlan({ ...samplePptMakerRequest, slideCount: 1 });
    const enhancement = await enhancePptDocument(deckPlan);
    const invalidDeck = {
      ...deckPlan,
      slides: [{
        ...deckPlan.slides[0],
        comparisonTable: {
          rationale: 'Comparison', columnHeaders: ['Criterion', 'Current'], rows: [{ criterion: '', values: ['Current'], emphasis: 'none' as const }], highlightedRowIndex: -1, keyResult: 'Result...',
        },
        chart: {
          purpose: 'target-progress' as const, type: 'progress' as const, rationale: 'Progress', series: [{ label: '', value: Number.NaN }], targetValue: 0, highlightedIndex: 0, unit: '%', keyResult: 'Progress...',
        },
        keyMetric: {
          label: '', displayValue: '', numericValue: Number.NaN, changeText: null, direction: 'neutral' as const, comparisonText: '', rationale: 'Metric',
        },
      }],
    };

    expect(getPptDesignQualityIssues(invalidDeck, enhancement.layouts)).toEqual(expect.arrayContaining([
      expect.stringContaining('comparison table needs exactly three'),
      expect.stringContaining('chart contains an incomplete'),
      expect.stringContaining('progress chart needs a positive'),
      expect.stringContaining('key metric is missing'),
    ]));
  });
});
