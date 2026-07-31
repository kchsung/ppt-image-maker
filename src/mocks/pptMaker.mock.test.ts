import { describe, expect, it } from 'vitest';
import { createMockDeckPlan, createMockSlideImageDataUrl, samplePptMakerRequest } from '@/mocks/pptMaker.mock';
import { getDeckCopyQaIssues } from '@/utils/pptMaker';

describe('PPT Maker mock data', () => {
  it('provides a complete deck plan and matching successful slide items', () => {
    const deck = createMockDeckPlan({ ...samplePptMakerRequest, slideCount: 4 });

    expect(deck.slides).toHaveLength(4);
    expect(deck.copyQa.status).toBe('passed');
    expect(getDeckCopyQaIssues(deck)).toEqual([]);
    expect(deck.slides.map((slide) => slide.visualStructure)).toEqual([
      'hero-visual',
      'message-emphasis',
      'card-grid',
      'closing-commitment',
    ]);
  });

  it('renders mock previews with approved copy rather than empty repeated cards', () => {
    const deck = createMockDeckPlan({ ...samplePptMakerRequest, slideCount: 4 });
    const imageDataUrl = createMockSlideImageDataUrl(deck.slides[0]);
    const svg = decodeURIComponent(escape(atob(imageDataUrl.split(',')[1])));

    expect(svg).toContain('AI accelerates execution');
    expect(svg).toContain('LOGO');
    expect(svg).toContain('AI draft');
  });

  it.each([
    ['light', 3],
    ['standard', 4],
    ['detailed', 5],
  ] as const)('creates the expected proof points for %s density', (contentDensity, expectedProofPointCount) => {
    const deck = createMockDeckPlan({ ...samplePptMakerRequest, slideCount: 4, contentDensity });

    expect(deck.slides.every((slide) => slide.contentBlocks.length === expectedProofPointCount)).toBe(true);
    expect(deck.slides.every((slide) => slide.labels.length === expectedProofPointCount)).toBe(true);
  });
});
