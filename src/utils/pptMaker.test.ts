import { describe, expect, it } from 'vitest';
import {
  createSlideTitle,
  extractKeywords,
  getDeckCopyQaIssues,
  selectVisualStructure,
  splitIntoSlideSeeds,
  summarizeText,
} from '@/utils/pptMaker';
import { samplePptMakerRequest } from '@/mocks/pptMaker.mock';

describe('pptMaker utilities', () => {
  it('splits source text into the requested number of slide seeds', () => {
    const seeds = splitIntoSlideSeeds(
      'AI changes execution. Human judgment still matters. Teams need workflows. Validation creates trust.',
      3,
    );

    expect(seeds).toHaveLength(3);
    expect(seeds[0]).toContain('AI changes execution');
  });

  it('extracts useful keywords from source text', () => {
    const keywords = extractKeywords('AI judgment judgment workflow validation validation validation', 2);

    expect(keywords).toEqual(['Validation', 'Judgment']);
  });

  it('creates a language-aware slide title', () => {
    expect(createSlideTitle('AI judgment creates better workflow', 'English', 2)).toContain('Moves From');
    expect(createSlideTitle('AI 판단과 실행 기준을 정리합니다', 'Korean', 2)).toContain('전환하기');
  });

  it('does not add ellipsis when summarizing slide text', () => {
    const summary = summarizeText(
      'This is a very long sentence that should be shortened without adding trailing ellipsis or placeholder dots.',
      45,
    );

    expect(summary).not.toContain('...');
    expect(summary).not.toContain('…');
  });

  it('assigns varied visual structures across a local fallback deck', () => {
    expect(selectVisualStructure(1, 6, 'cover')).toBe('hero-visual');
    expect(selectVisualStructure(2, 6, 'section-opener')).toBe('message-emphasis');
    expect(selectVisualStructure(3, 6, 'card-grid')).toBe('card-grid');
    expect(selectVisualStructure(6, 6, 'closing')).toBe('closing-commitment');
  });

  it('rejects Korean copy when English is requested', () => {
    const issues = getDeckCopyQaIssues({
      request: { ...samplePptMakerRequest, targetLanguage: 'English' },
      slides: [{
        id: 'slide-1',
        pageNumber: 1,
        archetype: 'cover',
        visualStructure: 'hero-visual',
        title: 'English title',
        subtitle: 'English subtitle',
        mainMessage: '\uD55C\uAE00 \uBB38\uAD6C\uAC00 \uC0AC\uC6A9\uB418\uC5C8\uC2B5\uB2C8\uB2E4.',
        labels: ['One', 'Two', 'Three'],
        takeaway: 'English takeaway.',
        imageSlot: {
          id: 'visual-1',
          purpose: 'Support the title with a text-free visual.',
          placement: 'right-hero',
          prompt: 'Text-free abstract editorial illustration.',
        },
        imagePrompt: '',
      }],
    });

    expect(issues).toHaveLength(1);
    expect(issues[0]).toContain('contains Korean copy while English was requested');
  });
});
