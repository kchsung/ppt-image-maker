import type { SlideArchetype, TargetLanguage } from '@/types/models/pptMaker.model';

const EN_STOP_WORDS = new Set([
  'the',
  'and',
  'for',
  'with',
  'that',
  'this',
  'from',
  'into',
  'your',
  'about',
  'need',
  'needs',
  'will',
  'should',
  'must',
]);

export function normalizeSourceText(sourceText: string): string {
  return sourceText.replace(/\s+/g, ' ').trim();
}

export function splitIntoSlideSeeds(sourceText: string, slideCount: number): string[] {
  const normalized = normalizeSourceText(sourceText);
  if (!normalized) {
    return [];
  }

  const sentenceMatches = normalized.match(/[^.!?。！？]+[.!?。！？]?/g) ?? [normalized];
  const sentences = sentenceMatches.map((sentence) => sentence.trim()).filter(Boolean);
  const safeCount = Math.max(1, Math.min(slideCount, 20));
  const groups: string[] = Array.from({ length: safeCount }, () => '');

  sentences.forEach((sentence, index) => {
    const targetIndex = index % safeCount;
    groups[targetIndex] = `${groups[targetIndex]} ${sentence}`.trim();
  });

  return groups.map((group, index) => group || sentences[index % sentences.length] || normalized);
}

export function extractKeywords(text: string, limit = 4): string[] {
  const words = text
    .replace(/[^\p{L}\p{N}\s-]/gu, ' ')
    .split(/\s+/)
    .map((word) => word.trim())
    .filter((word) => word.length > 2)
    .filter((word) => !EN_STOP_WORDS.has(word.toLowerCase()));

  const counts = new Map<string, number>();
  words.forEach((word) => {
    const key = word.toLowerCase();
    counts.set(key, (counts.get(key) ?? 0) + 1);
  });

  return Array.from(counts.entries())
    .sort((left, right) => right[1] - left[1])
    .slice(0, limit)
    .map(([word]) => titleCase(word));
}

export function selectArchetype(pageNumber: number, totalSlides: number): SlideArchetype {
  if (pageNumber === 1) {
    return 'cover';
  }
  if (pageNumber === totalSlides) {
    return 'closing';
  }
  const flow: SlideArchetype[] = ['section-opener', 'card-grid', 'comparison', 'process', 'before-after', 'case-dashboard'];
  return flow[(pageNumber - 2) % flow.length];
}

export function createSlideTitle(seed: string, language: TargetLanguage, pageNumber: number): string {
  const keywords = extractKeywords(seed, 3);
  if (language === 'Korean') {
    const main = keywords[0] ?? `핵심 ${pageNumber}`;
    const contrast = keywords[1] ?? '실행';
    return `${main}에서 ${contrast}로 전환하기`;
  }

  const main = keywords[0] ?? `Idea ${pageNumber}`;
  const contrast = keywords[1] ?? 'Action';
  return `${main} Moves From Insight To ${contrast}`;
}

export function summarizeText(seed: string, maxLength = 150): string {
  const trimmed = normalizeSourceText(seed);
  if (trimmed.length <= maxLength) {
    return trimmed;
  }
  return `${trimmed.slice(0, maxLength).trim()}...`;
}

export function titleCase(value: string): string {
  return value.replace(/\b\w/g, (char) => char.toUpperCase());
}
