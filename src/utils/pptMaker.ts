import type { PptDeckPlan, SlideArchetype, SlideVisualStructure, TargetLanguage } from '@/types/models/pptMaker.model';

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

const SENTENCE_PATTERN = /[^.!?。！？]+[.!?。！？]?/g;

export function normalizeSourceText(sourceText: string): string {
  return stripEllipsis(sourceText).replace(/\s+/g, ' ').trim();
}

export function splitIntoSlideSeeds(sourceText: string, slideCount: number): string[] {
  const normalized = normalizeSourceText(sourceText);
  if (!normalized) {
    return [];
  }

  const sentenceMatches = normalized.match(SENTENCE_PATTERN) ?? [normalized];
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
  const words = normalizeSourceText(text)
    .replace(/[^\p{L}\p{N}\s-]/gu, ' ')
    .split(/\s+/)
    .map((word) => word.trim())
    .filter((word) => word.length > 1)
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

export function selectVisualStructure(
  pageNumber: number,
  totalSlides: number,
  archetype: SlideArchetype,
): SlideVisualStructure {
  if (pageNumber === 1) return 'hero-visual';
  if (pageNumber === totalSlides) return 'closing-commitment';

  const structureByArchetype: Record<Exclude<SlideArchetype, 'cover' | 'closing'>, SlideVisualStructure> = {
    'section-opener': 'message-emphasis',
    'card-grid': 'card-grid',
    comparison: 'side-by-side-comparison',
    process: 'numbered-process',
    'before-after': 'before-after-mapping',
    'case-dashboard': 'case-story',
  };

  return structureByArchetype[archetype as Exclude<SlideArchetype, 'cover' | 'closing'>] ?? 'hub-and-spoke';
}

export function getVisualStructureDescription(structure: SlideVisualStructure): string {
  const descriptions: Record<SlideVisualStructure, string> = {
    'hero-visual': 'One strong visual with a concise opening claim and generous whitespace.',
    'message-emphasis': 'A bold central statement with two or three supporting visual cues.',
    'card-grid': 'Three to five parallel cards arranged as a balanced grid.',
    'side-by-side-comparison': 'Two clearly separated columns that contrast alternatives or states.',
    'numbered-process': 'A directional sequence of numbered steps connected by arrows.',
    'before-after-mapping': 'Paired before and after states linked by a transformation path.',
    'hub-and-spoke': 'One central concept connected to surrounding contributors or outcomes.',
    'metrics-dashboard': 'A compact dashboard with key metrics, a chart zone, and an insight panel.',
    roadmap: 'A milestone timeline that moves from current priorities to a destination.',
    'pyramid-framework': 'A layered pyramid showing foundations, capabilities, and higher outcomes.',
    'case-story': 'A scenario flow that shows context, evidence, decision, and outcome.',
    'closing-commitment': 'A decisive closing statement with a focused next action or commitment.',
  };

  return descriptions[structure];
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

  const sentences = trimmed.match(SENTENCE_PATTERN)?.map((sentence) => sentence.trim()).filter(Boolean) ?? [];
  const completeSentence = sentences.find((sentence) => sentence.length <= maxLength);
  if (completeSentence) {
    return stripEllipsis(completeSentence);
  }

  const words = trimmed.split(/\s+/);
  const selected: string[] = [];
  for (const word of words) {
    const next = [...selected, word].join(' ');
    if (next.length > maxLength) {
      break;
    }
    selected.push(word);
  }

  return stripEllipsis(selected.join(' ') || trimmed.slice(0, maxLength).trim());
}

export function validateSlideText(value: string, language: TargetLanguage): string {
  const cleaned = stripEllipsis(value);
  if (language === 'Korean') {
    return cleaned.replace(/\b(Designed for|Turn|Insight|Action|Idea)\b/gi, '').replace(/\s+/g, ' ').trim();
  }

  return cleaned;
}

export function titleCase(value: string): string {
  return value.replace(/\b\w/g, (char) => char.toUpperCase());
}

const FORBIDDEN_COPY_PATTERNS = [
  /\.{2,}/,
  /…/u,
  /\[[^\]]*(?:page|페이지)[^\]]*\]/iu,
  /\bDesigned for\b/iu,
  /\bMoves From\b/iu,
  /\bSlide Title\b/iu,
  /\bKey Point\b/iu,
  /\bLorem ipsum\b/iu,
];

const HANGUL_CHARACTER_PATTERN = /[\u3131-\u318e\uac00-\ud7a3]/u;

export function getDeckCopyQaIssues(deckPlan: Pick<PptDeckPlan, 'request' | 'slides'>): string[] {
  const issues: string[] = [];

  deckPlan.slides.forEach((slide) => {
    const fields = [slide.title, slide.subtitle, slide.mainMessage, slide.takeaway, ...slide.labels];
    fields.forEach((value) => {
      const text = value.trim();
      if (!text) {
        issues.push(`Slide ${slide.pageNumber} contains an empty copy field.`);
        return;
      }

      if (FORBIDDEN_COPY_PATTERNS.some((pattern) => pattern.test(text))) {
        issues.push(`Slide ${slide.pageNumber} contains placeholder or clipped copy: "${text}".`);
      }

      if (deckPlan.request.targetLanguage === 'Korean' && hasUnapprovedLatinCopy(text)) {
        issues.push(`Slide ${slide.pageNumber} contains unapproved English copy: "${text}".`);
      }

      if (deckPlan.request.targetLanguage === 'English' && HANGUL_CHARACTER_PATTERN.test(text)) {
        issues.push(`Slide ${slide.pageNumber} contains Korean copy while English was requested: "${text}".`);
      }
    });
  });

  const structures = deckPlan.slides.map((slide) => slide.visualStructure);
  const requiredDistinctStructures = Math.min(deckPlan.slides.length, 4);
  if (new Set(structures).size < requiredDistinctStructures) {
    issues.push(`Deck needs at least ${requiredDistinctStructures} distinct visual structures.`);
  }
  structures.forEach((structure, index) => {
    if (index > 0 && structure === structures[index - 1]) {
      issues.push(`Slides ${index} and ${index + 1} repeat the same visual structure.`);
    }
  });

  return Array.from(new Set(issues));
}

function hasUnapprovedLatinCopy(value: string): boolean {
  const tokens = value.match(/[A-Za-z][A-Za-z-]*/g) ?? [];
  return tokens.some((token) => !['AI', 'QLEARN', 'PPT', 'CTO', 'CEO'].includes(token));
}

export function stripEllipsis(value: string): string {
  return value.replace(/\.{2,}|…/g, '').replace(/\s+/g, ' ').trim();
}
