import { describe, expect, it } from 'vitest';
import { enhancePptDocument, validateEditableLayout } from '@/services/pptDocument.service';
import type { PptEditableSlideLayout, SlideVisualStructure } from '@/types/models/pptMaker.model';
import { samplePptMakerRequest } from '@/mocks/pptMaker.mock';
import { pptMakerService } from '@/services/pptMaker.service';
import { MIN_PPT_TEXT_FONT_SIZE, getEditableTextLayoutIssues } from '@/utils/pptTextLayout';

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

  it('does not block the HTML/CSS export path on a PptxGenJS fallback-only preflight finding', async () => {
    const deckPlan = await pptMakerService.generateDeckPlan({
      ...samplePptMakerRequest,
      slideCount: 1,
      contentDensity: 'detailed',
    });
    const detailedDeck = {
      ...deckPlan,
      slides: deckPlan.slides.map((slide) => ({
        ...slide,
        contentBlocks: slide.contentBlocks.slice(0, 3),
        labels: slide.labels.slice(0, 3),
      })),
    };

    const result = await enhancePptDocument(detailedDeck);

    expect(result.generationMode).toBe('dom-to-pptx');
    expect(result.qaChecklist).toEqual(expect.arrayContaining([
      expect.stringContaining('secondary PptxGenJS fallback layout has'),
    ]));
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
      { id: 'logo', role: 'logo', text: '\uB85C\uACE0', x: 11.62, y: 0.38, w: 1.12, h: 0.34, fontSize: 8 },
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

  it('keeps linked source citations editable and readable in the PPTX layout', async () => {
    const deckPlan = await pptMakerService.generateDeckPlan({ ...samplePptMakerRequest, slideCount: 1 });
    const citedDeck = {
      ...deckPlan,
      request: { ...deckPlan.request, sourceMaterialAnalysis: { summary: 'Source evidence', keyPoints: ['Verified evidence'], dataPoints: ['72% adoption'], availableVisuals: [], sources: [{ id: 'report', sourceName: 'OECD', documentName: 'AI Outlook', publicationYear: 2025, url: 'https://example.com/oecd', verifiedAt: '2026-07-31', metadataStatus: 'complete' as const }] } },
      slides: deckPlan.slides.map((slide) => ({ ...slide, sourceIds: ['report'] })),
    };

    const result = await enhancePptDocument(citedDeck);
    const sourceBlock = result.layouts[0]?.textBlocks.find((block) => block.id === 'source');

    expect(sourceBlock).toEqual(expect.objectContaining({ text: 'Source: OECD - AI Outlook (2025)', role: 'footer' }));
    expect(sourceBlock?.fontSize).toBeGreaterThanOrEqual(MIN_PPT_TEXT_FONT_SIZE);
  });

  it('keeps every editable text block readable across all visual structures and both deck languages', async () => {
    const visualStructures: SlideVisualStructure[] = [
      'hero-visual',
      'message-emphasis',
      'card-grid',
      'side-by-side-comparison',
      'numbered-process',
      'before-after-mapping',
      'hub-and-spoke',
      'metrics-dashboard',
      'roadmap',
      'pyramid-framework',
      'case-story',
      'closing-commitment',
    ];
    const englishDeck = await pptMakerService.generateDeckPlan({
      ...samplePptMakerRequest,
      slideCount: 12,
      contentDensity: 'detailed',
    });
    const englishAllStructureDeck = {
      ...englishDeck,
      slides: englishDeck.slides.map((slide, slideIndex) => ({
        ...slide,
        visualStructure: visualStructures[slideIndex],
        contentBlocks: Array.from({ length: 5 }, (_, blockIndex) => ({
          heading: `Proof point ${blockIndex + 1}`,
          detail: `Evidence ${blockIndex + 1} links the claim to a source, owner, and decision.`,
        })),
        labels: Array.from({ length: 5 }, (_, blockIndex) => `Proof point ${blockIndex + 1}`),
      })),
    };
    const koreanDeck = {
      ...englishAllStructureDeck,
      request: { ...englishAllStructureDeck.request, targetLanguage: 'Korean' as const },
      slides: englishAllStructureDeck.slides.map((slide) => ({
        ...slide,
        title: `\uac80\uc99d \uac00\ub2a5\ud55c \uc2e4\ud589 \uad6c\uc870 ${slide.pageNumber}`,
        subtitle: '\uc99d\uac70\uc640 \ucc45\uc784\uc744 \uc5f0\uacb0\ud558\uc5ec \uc758\uc0ac\uacb0\uc815\uc5d0 \ud65c\uc6a9\ud569\ub2c8\ub2e4.',
        objective: '\uac01 \uc7a5\ud45c\uc5d0\uc11c \ud544\uc694\ud55c \uacb0\uc815\uacfc \ub2e4\uc74c \uc2e4\ud589 \ub2e8\uacc4\ub97c \uba85\ud655\ud788 \uc81c\uc2dc\ud569\ub2c8\ub2e4.',
        mainMessage: '\uc8fc\uc7a5\uacfc \uc99d\uac70, \ucc45\uc784\uc790, \ud6c4\uc18d \uc870\uce58\ub97c \ud55c \ud654\uba74\uc5d0\uc11c \uc774\ud574\ud560 \uc218 \uc788\uac8c \uad6c\uc131\ud569\ub2c8\ub2e4.',
        contentBlocks: slide.contentBlocks.map((_, index) => ({
          heading: `\uc2e4\ud589 \uc99d\uac70 ${index + 1}`,
          detail: '\ucd9c\ucc98 \uae30\ubc18 \uc124\uba85\uc744 \ud1b5\ud574 \uc774 \uc99d\uac70\uac00 \uc65c \uc911\uc694\ud55c\uc9c0\uc640 \uc2e4\ud589 \uc2dc \uace0\ub824\ud560 \uc870\uac74\uc744 \uba85\ud655\ud788 \uc81c\uc2dc\ud569\ub2c8\ub2e4.',
        })),
        labels: slide.contentBlocks.map((_, index) => `\uc2e4\ud589 \uc99d\uac70 ${index + 1}`),
        decision: '\ucc45\uc784\uc790\uc640 \uc2e4\ud589 \uc2dc\uc810\uc744 \ud569\uc758\ud558\uace0 \ub2e4\uc74c \ub2e8\uacc4\ub85c \uc9c4\ud589\ud569\ub2c8\ub2e4.',
        takeaway: '\uac80\uc99d \uac00\ub2a5\ud55c \uc99d\uac70\uac00 \uc9c0\uc18d\uc801\uc778 \uc2e4\ud589\uc73c\ub85c \uc774\uc5b4\uc9d1\ub2c8\ub2e4.',
      })),
    };

    for (const deckPlan of [englishAllStructureDeck, koreanDeck]) {
      const result = await enhancePptDocument(deckPlan);
      const textBlocks = result.layouts.flatMap((layout) => layout.textBlocks);

      expect(result.layouts).toHaveLength(12);
      expect(getEditableTextLayoutIssues(textBlocks)).toEqual([]);
      expect(textBlocks.filter((block) => block.text).every((block) => block.fontSize >= MIN_PPT_TEXT_FONT_SIZE)).toBe(true);
    }
  });
});
