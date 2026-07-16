import { describe, expect, it } from 'vitest';
import { createSlideTitle, extractKeywords, splitIntoSlideSeeds } from '@/utils/pptMaker';

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
});
