import type {
  ContentDensity,
  PptCoverageSuggestion,
  PptDeckPlan,
  PptRedundancySuggestion,
  SlideArchetype,
  SlideContentClassification,
  SlideDiagramSpec,
  SlideDiagramType,
  SlideComparisonTableSpec,
  SlideChartSpec,
  SlideChartPurpose,
  SlideKeyMetricSpec,
  SlideLayoutFamily,
  SlideLayoutSelection,
  SlideMasterLayoutDefinition,
  SlideMasterLayoutId,
  SlidePlan,
  SlideVisualStructure,
  TargetLanguage,
} from '@/types/models/pptMaker.model';

export const PPT_MASTER_LAYOUTS: Record<SlideMasterLayoutId, SlideMasterLayoutDefinition> = {
  cover: {
    id: 'cover',
    name: 'Cover',
    purpose: 'Establish the deck thesis, audience context, and visual identity.',
    supportedVisualStructures: ['hero-visual'],
  },
  agenda: {
    id: 'agenda',
    name: 'Agenda',
    purpose: 'Preview the narrative path and orient the audience before evidence begins.',
    supportedVisualStructures: ['message-emphasis', 'card-grid'],
  },
  section: {
    id: 'section',
    name: 'Section',
    purpose: 'Introduce the next decision chapter and its guiding question.',
    supportedVisualStructures: ['message-emphasis', 'pyramid-framework'],
  },
  content: {
    id: 'content',
    name: 'Content',
    purpose: 'Explain a core claim through evidence, process, framework, or case detail.',
    supportedVisualStructures: ['card-grid', 'numbered-process', 'roadmap', 'hub-and-spoke', 'pyramid-framework', 'case-story'],
  },
  comparison: {
    id: 'comparison',
    name: 'Comparison',
    purpose: 'Contrast alternatives, current and future states, or decision trade-offs.',
    supportedVisualStructures: ['side-by-side-comparison', 'before-after-mapping'],
  },
  chart: {
    id: 'chart',
    name: 'Chart',
    purpose: 'Present decision-relevant measures and source-backed evidence.',
    supportedVisualStructures: ['metrics-dashboard'],
  },
  conclusion: {
    id: 'conclusion',
    name: 'Conclusion',
    purpose: 'Summarize the commitment, owner, and next action.',
    supportedVisualStructures: ['closing-commitment'],
  },
};

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
  const safeCount = Math.max(1, Math.min(slideCount, 100));
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

export function selectContentAwareLayout(
  slide: Pick<SlidePlan, 'title' | 'mainMessage' | 'contentBlocks' | 'slideRole'>,
  options: {
    index: number;
    totalSlides: number;
    previousStructure?: SlideVisualStructure;
    templateRecommendedStructures?: SlideVisualStructure[];
  },
): { visualStructure: SlideVisualStructure; layoutSelection: SlideLayoutSelection; diagram: SlideDiagramSpec } {
  const { index, totalSlides, previousStructure, templateRecommendedStructures = [] } = options;
  if (index === 0) {
    return {
      visualStructure: 'hero-visual',
      diagram: createNoDiagram('The opening slide establishes the deck thesis before introducing a detailed diagram.'),
      layoutSelection: { classification: 'message', family: 'hero', rationale: 'Opening slide uses a focused hero composition to establish the deck thesis.' },
    };
  }
  if (totalSlides > 1 && index === totalSlides - 1) {
    return {
      visualStructure: 'closing-commitment',
      diagram: createNoDiagram('The closing slide focuses on the commitment and next action rather than a detailed diagram.'),
      layoutSelection: { classification: 'message', family: 'closing', rationale: 'Closing slide uses a commitment composition to make the next action explicit.' },
    };
  }

  const classification = classifySlideContent(slide);
  const diagram = deriveSlideDiagram(slide);
  const candidates = diagram.type === 'none'
    ? getLayoutCandidates(classification)
    : getDiagramStructureCandidates(diagram.type);
  const preferred = templateRecommendedStructures.find((structure) => candidates.includes(structure));
  const rotationStart = index % candidates.length;
  const rotatedCandidates = [...candidates.slice(rotationStart), ...candidates.slice(0, rotationStart)];
  const previousFamily = previousStructure ? getLayoutFamily(previousStructure) : undefined;
  const eligibleCandidates = [preferred, ...rotatedCandidates]
    .filter((structure): structure is SlideVisualStructure => Boolean(structure));
  const visualStructure = eligibleCandidates
    .find((structure) =>
      structure !== previousStructure &&
      getLayoutFamily(structure) !== previousFamily)
    ?? eligibleCandidates.find((structure) => structure !== previousStructure)
    ?? candidates[0];

  return {
    visualStructure,
    diagram,
    layoutSelection: {
      classification,
      family: getLayoutFamily(visualStructure),
      rationale: getLayoutRationale(classification, visualStructure),
    },
  };
}

export function deriveSlideDiagram(
  slide: Pick<SlidePlan, 'title' | 'mainMessage' | 'contentBlocks' | 'slideRole'>,
): SlideDiagramSpec {
  const copy = getSlideSearchText(slide).toLocaleLowerCase();
  const nodes = slide.contentBlocks
    .map((block) => block.heading.trim())
    .filter(Boolean)
    .slice(0, 5);
  const fallbackNodes = nodes.length >= 3 ? nodes : [slide.title, slide.mainMessage].filter(Boolean).slice(0, 3);
  const classification = classifySlideContent(slide);

  if (classification === 'data' || classification === 'case') {
    return createNoDiagram('The slide is evidence- or case-led, so its chart or case layout should remain the primary visual structure.');
  }

  const matches = (expression: RegExp) => expression.test(copy);
  if (slide.slideRole === 'comparison' || matches(/\b(?:before-and-after|before\/after|current state|future state|transform|transition|change)\b|변화|전환|개선/u)) {
    return { type: 'change', rationale: 'The slide contrasts a current and target state, so it should show the change explicitly.', nodes: fallbackNodes };
  }
  if (matches(/\b(?:timeline|milestone|quarter|phase|year|month|roadmap|schedule)\b|타임라인|마일스톤|분기|연도|일정|로드맵/u)) {
    return { type: 'timeline', rationale: 'The slide contains time-based milestones or phases, so it should use a timeline.', nodes: fallbackNodes };
  }
  if (matches(/\b(?:cycle|loop|iterate|iteration|feedback|continuous)\b|순환|반복|피드백|선순환/u)) {
    return { type: 'cycle', rationale: 'The slide describes a repeating feedback loop, so it should use a cycle diagram.', nodes: fallbackNodes };
  }
  if (matches(/\b(?:hierarchy|layer|tier|level|foundation|pyramid)\b|계층|기반|상위|하위|레벨|피라미드/u)) {
    return { type: 'hierarchy', rationale: 'The slide describes ordered layers or capability levels, so it should use a hierarchy.', nodes: fallbackNodes };
  }
  if (matches(/\b(?:relationship|ecosystem|network|stakeholder|interaction|interconnected)\b|관계|연결|네트워크|이해관계|상호작용/u)) {
    return { type: 'relationship', rationale: 'The slide describes connected entities, so it should use a relationship map.', nodes: fallbackNodes };
  }
  if (slide.slideRole === 'implementation' || matches(/\b(?:process|step|sequence|rollout|implement)\b|프로세스|절차|순서|단계|실행/u)) {
    return { type: 'process', rationale: 'The slide describes an ordered workflow, so it should use a process diagram.', nodes: fallbackNodes };
  }

  return createNoDiagram('The slide is best communicated with an editorial content layout rather than a formal diagram.');
}

export function deriveSlideComparisonTable(
  slide: Pick<SlidePlan, 'title' | 'mainMessage' | 'contentBlocks' | 'labels' | 'slideRole' | 'comparisonTable'>,
): SlideComparisonTableSpec | undefined {
  const existing = slide.comparisonTable;
  if (existing && existing.columnHeaders.length >= 2 && existing.rows.length > 0) {
    return {
      ...existing,
      columnHeaders: existing.columnHeaders.slice(0, 3),
      rows: existing.rows.slice(0, 5).map((row) => ({
        criterion: row.criterion.trim(),
        values: row.values.map((value) => value.trim()).filter(Boolean).slice(0, 2),
        emphasis: row.emphasis ?? 'none',
      })).filter((row) => row.criterion && row.values.length >= 2),
    };
  }

  const copy = getSlideSearchText(slide).toLocaleLowerCase();
  const isComparison = slide.slideRole === 'comparison' || /\b(?:versus|vs|trade-?off|alternative|before|after|compare|current|target)\b|비교|대안|전후|차이|현황|목표/u.test(copy);
  const blocks = slide.contentBlocks.filter((block) => block.heading.trim() && block.detail.trim());
  if (!isComparison || blocks.length < 2) return undefined;

  const midpoint = Math.ceil(blocks.length / 2);
  const leftBlocks = blocks.slice(0, midpoint);
  const rightBlocks = blocks.slice(midpoint);
  const pairedRows: SlideComparisonTableSpec['rows'] = leftBlocks.map((left, index) => {
    const right = rightBlocks[index] ?? rightBlocks[rightBlocks.length - 1] ?? left;
    return {
      criterion: left.heading.trim(),
      values: [left.detail.trim(), right.detail.trim()],
      emphasis: (hasMeaningfulNumericDifference(left.detail, right.detail) ? 'difference' : 'none') as SlideComparisonTableSpec['rows'][number]['emphasis'],
    };
  }).filter((row) => row.values[0] && row.values[1]);

  if (pairedRows.length === 0) return undefined;
  const highlightedRowIndex = pairedRows.findIndex((row) => row.emphasis === 'difference');
  const fallbackIndex = highlightedRowIndex >= 0 ? highlightedRowIndex : pairedRows.length - 1;
  const featuredRow = pairedRows[fallbackIndex];
  if (!featuredRow) return undefined;
  featuredRow.emphasis = featuredRow.emphasis === 'difference' ? 'difference' : 'key-result';

  const labels = (slide.labels ?? []).map((label) => label.trim()).filter(Boolean);
  const [leftHeader, rightHeader] = labels.length >= 2
    ? labels.slice(0, 2)
    : ['Current state', 'Recommended state'];
  return {
    rationale: 'The slide compares alternatives or states, so criteria and outcomes are shown in an editable table.',
    columnHeaders: ['Criterion', leftHeader, rightHeader],
    rows: pairedRows.slice(0, 5),
    highlightedRowIndex: fallbackIndex,
    keyResult: featuredRow.criterion,
  };
}

export function deriveSlideChart(
  slide: Pick<SlidePlan, 'title' | 'mainMessage' | 'contentBlocks' | 'slideRole' | 'chart'>,
): SlideChartSpec | undefined {
  const existing = slide.chart;
  if (existing && existing.series.length > 0) {
    return {
      ...existing,
      series: existing.series
        .filter((item) => item.label.trim() && Number.isFinite(item.value))
        .slice(0, 6)
        .map((item) => ({ label: item.label.trim(), value: item.value })),
      highlightedIndex: existing.highlightedIndex !== null && existing.highlightedIndex >= 0 && existing.highlightedIndex < existing.series.length
        ? existing.highlightedIndex
        : null,
    };
  }

  const copy = getSlideSearchText(slide).toLocaleLowerCase();
  const series = slide.contentBlocks.map((block) => ({ label: block.heading.trim(), value: extractFirstNumber(block.detail) }))
    .filter((item): item is { label: string; value: number } => Boolean(item.label) && item.value !== null)
    .slice(0, 6);
  if (series.length === 0) return undefined;

  const purpose = selectChartPurpose(copy, series.length);
  if ((purpose === 'comparison' || purpose === 'trend' || purpose === 'composition' || purpose === 'distribution') && series.length < 2) return undefined;
  const targetValue = purpose === 'target-progress'
    ? extractTargetValue(copy) ?? (/%/u.test(slide.contentBlocks.map((block) => block.detail).join(' ')) ? 100 : null)
    : null;
  if (purpose === 'target-progress' && targetValue === null) return undefined;
  const maxIndex = series.reduce((bestIndex, item, index) => item.value > series[bestIndex]!.value ? index : bestIndex, 0);
  const typeByPurpose: Record<SlideChartPurpose, SlideChartSpec['type']> = {
    comparison: 'bar', trend: 'line', composition: 'donut', distribution: 'histogram', 'target-progress': 'progress',
  };
  return {
    purpose,
    type: typeByPurpose[purpose],
    rationale: `Source-backed numeric evidence is best communicated as a ${typeByPurpose[purpose]} chart for ${purpose}.`,
    series,
    targetValue,
    highlightedIndex: maxIndex,
    unit: /%/u.test(slide.contentBlocks.map((block) => block.detail).join(' ')) ? '%' : '',
    keyResult: `${series[maxIndex]!.label}: ${series[maxIndex]!.value}${/%/u.test(slide.contentBlocks.map((block) => block.detail).join(' ')) ? '%' : ''}`,
  };
}

export function deriveSlideKeyMetric(
  slide: Pick<SlidePlan, 'title' | 'mainMessage' | 'contentBlocks' | 'keyMetric'>,
): SlideKeyMetricSpec | undefined {
  const existing = slide.keyMetric;
  if (existing && existing.label.trim() && existing.displayValue.trim() && Number.isFinite(existing.numericValue)) {
    return {
      ...existing,
      label: existing.label.trim(),
      displayValue: existing.displayValue.trim(),
      comparisonText: existing.comparisonText.trim(),
      changeText: existing.changeText?.trim() || null,
    };
  }

  const rankedBlocks = [...slide.contentBlocks]
    .map((block, index) => ({ block, index, score: getMetricImportanceScore(block.heading, block.detail, index) }))
    .sort((left, right) => right.score - left.score);
  const candidate = rankedBlocks.find(({ block }) => extractFirstNumber(block.detail) !== null);
  if (!candidate) return undefined;
  const numericValue = extractFirstNumber(candidate.block.detail);
  if (numericValue === null) return undefined;
  const valueToken = candidate.block.detail.match(/-?\d+(?:[.,]\d+)?\s*[%$€£₩]?/u)?.[0]?.replace(/\s+/g, '') ?? String(numericValue);
  const change = extractMetricChange(candidate.block.detail);
  return {
    label: candidate.block.heading.trim(),
    displayValue: valueToken,
    numericValue,
    changeText: change?.text ?? null,
    direction: change?.direction ?? 'neutral',
    comparisonText: compactEditableCopy(candidate.block.detail, 90),
    rationale: 'The most decision-relevant source-backed value is promoted as the slide key metric.',
  };
}

function getMetricImportanceScore(heading: string, detail: string, index: number): number {
  const copy = `${heading} ${detail}`.toLocaleLowerCase();
  const signalCount = (copy.match(/\b(?:kpi|roi|revenue|growth|adoption|cost|time|risk|target|goal|increase|decrease)\b|성과|증가|감소|목표|달성|비용|매출|시간|위험/g) ?? []).length;
  return signalCount * 10 - index;
}

function extractMetricChange(value: string): { text: string; direction: SlideKeyMetricSpec['direction'] } | undefined {
  const explicit = value.match(/([+-]\s*\d+(?:[.,]\d+)?\s*%)/u)?.[1]?.replace(/\s+/g, '');
  if (explicit) return { text: explicit, direction: explicit.startsWith('-') ? 'down' : 'up' };
  const directional = value.match(/(\d+(?:[.,]\d+)?\s*%\s*(?:increase|decrease|up|down|증가|감소))/iu)?.[1];
  if (!directional) return undefined;
  const normalized = directional.replace(/\s+/g, ' ');
  return { text: normalized, direction: /decrease|down|감소/iu.test(normalized) ? 'down' : 'up' };
}

function selectChartPurpose(copy: string, valueCount: number): SlideChartPurpose {
  if (/\b(?:target|goal|attainment|achievement|progress)\b|목표|달성|진척/u.test(copy)) return 'target-progress';
  if (/\b(?:share|mix|composition|portion|breakdown)\b|구성비|비중|점유/u.test(copy)) return 'composition';
  if (/\b(?:distribution|spread|frequency|segment)\b|분포|빈도|구간/u.test(copy)) return 'distribution';
  if (/\b(?:trend|over time|quarter|monthly|yearly|trajectory)\b|추세|분기|월별|연도별/u.test(copy)) return 'trend';
  return valueCount >= 2 ? 'comparison' : 'target-progress';
}

function extractFirstNumber(value: string): number | null {
  const match = value.match(/-?\d+(?:[.,]\d+)?/u)?.[0];
  if (!match) return null;
  const number = Number(match.replace(',', '.'));
  return Number.isFinite(number) ? number : null;
}

function extractTargetValue(value: string): number | null {
  const match = value.match(/(?:target|goal|목표)\s*[:=]?\s*(-?\d+(?:[.,]\d+)?)/iu)?.[1];
  if (!match) return null;
  const number = Number(match.replace(',', '.'));
  return Number.isFinite(number) ? number : null;
}

function hasMeaningfulNumericDifference(left: string, right: string): boolean {
  const numberPattern = /-?\d+(?:[.,]\d+)?/g;
  const leftNumbers = left.match(numberPattern) ?? [];
  const rightNumbers = right.match(numberPattern) ?? [];
  if (leftNumbers.length === 0 || rightNumbers.length === 0) return false;
  const leftNumber = leftNumbers.at(0);
  const rightNumber = rightNumbers.at(0);
  if (!leftNumber || !rightNumber) return false;
  const leftValue = Number(leftNumber.replace(',', '.'));
  const rightValue = Number(rightNumber.replace(',', '.'));
  if (!Number.isFinite(leftValue) || !Number.isFinite(rightValue)) return false;
  return Math.abs(rightValue - leftValue) >= Math.max(1, Math.abs(leftValue) * 0.2);
}

function createNoDiagram(rationale: string): SlideDiagramSpec {
  return { type: 'none', rationale, nodes: [] };
}

function getDiagramStructureCandidates(type: Exclude<SlideDiagramType, 'none'>): SlideVisualStructure[] {
  const candidates: Record<Exclude<SlideDiagramType, 'none'>, SlideVisualStructure[]> = {
    process: ['numbered-process', 'roadmap'],
    cycle: ['hub-and-spoke', 'numbered-process'],
    hierarchy: ['pyramid-framework', 'hub-and-spoke'],
    timeline: ['roadmap', 'numbered-process'],
    relationship: ['hub-and-spoke', 'card-grid'],
    change: ['before-after-mapping', 'side-by-side-comparison'],
  };
  return candidates[type];
}

function classifySlideContent(
  slide: Pick<SlidePlan, 'title' | 'mainMessage' | 'contentBlocks' | 'slideRole'>,
): SlideContentClassification {
  const copy = getSlideSearchText(slide);
  if (slide.slideRole === 'comparison' || /\b(?:versus|vs|trade-?off|alternative|before|after|compare)\b|비교|대안|전후|차이/u.test(copy)) return 'comparison';
  if (slide.slideRole === 'case-study' || /\b(?:case|customer|example|scenario|pilot)\b|사례|고객|예시|시나리오|파일럿/u.test(copy)) return 'case';
  if (/\b(?:timeline|milestone|quarter|phase|year|month|roadmap)\b|타임라인|일정|단계별|분기|연도|로드맵/u.test(copy)) return 'timeline';
  if (slide.slideRole === 'implementation' || /\b(?:process|workflow|step|sequence|implement|rollout)\b|프로세스|절차|단계|실행|도입/u.test(copy)) return 'process';
  if (slide.slideRole === 'evidence' || /\b(?:kpi|metric|measure|target|baseline|roi|okr|data)\b|KPI|지표|측정|목표|데이터|성과/u.test(copy)) return 'data';
  if (slide.slideRole === 'solution' || /\b(?:model|system|architecture|framework|capability|component)\b|구조|체계|모델|아키텍처|역량|구성/u.test(copy)) return 'structure';
  return 'message';
}

function getLayoutCandidates(classification: SlideContentClassification): SlideVisualStructure[] {
  const candidates: Record<SlideContentClassification, SlideVisualStructure[]> = {
    comparison: ['side-by-side-comparison', 'before-after-mapping', 'card-grid'],
    process: ['numbered-process', 'roadmap', 'hub-and-spoke'],
    timeline: ['roadmap', 'numbered-process', 'case-story'],
    structure: ['hub-and-spoke', 'pyramid-framework', 'card-grid'],
    data: ['metrics-dashboard', 'side-by-side-comparison', 'card-grid'],
    case: ['case-story', 'before-after-mapping', 'side-by-side-comparison'],
    message: ['message-emphasis', 'card-grid', 'pyramid-framework'],
  };
  return candidates[classification];
}

export function getLayoutFamily(structure: SlideVisualStructure): SlideLayoutFamily {
  const familyByStructure: Record<SlideVisualStructure, SlideLayoutFamily> = {
    'hero-visual': 'hero',
    'message-emphasis': 'message',
    'card-grid': 'card',
    'side-by-side-comparison': 'comparison',
    'numbered-process': 'process',
    'before-after-mapping': 'comparison',
    'hub-and-spoke': 'structure',
    'metrics-dashboard': 'data',
    roadmap: 'timeline',
    'pyramid-framework': 'structure',
    'case-story': 'case',
    'closing-commitment': 'closing',
  };

  return familyByStructure[structure];
}

export function selectSlideMasterLayout(
  slide: Pick<SlidePlan, 'pageNumber' | 'archetype' | 'slideRole' | 'visualStructure'>,
  totalSlides: number,
): SlideMasterLayoutId {
  if (slide.pageNumber === 1 || slide.slideRole === 'opening' || slide.visualStructure === 'hero-visual') {
    return 'cover';
  }
  if (totalSlides > 1 && (slide.pageNumber === totalSlides || slide.slideRole === 'conclusion' || slide.visualStructure === 'closing-commitment')) {
    return 'conclusion';
  }
  if (slide.pageNumber === 2 && totalSlides >= 6) {
    return 'agenda';
  }
  if (slide.slideRole === 'comparison' || slide.visualStructure === 'side-by-side-comparison' || slide.visualStructure === 'before-after-mapping') {
    return 'comparison';
  }
  if (slide.slideRole === 'evidence' || slide.visualStructure === 'metrics-dashboard') {
    return 'chart';
  }
  if (slide.archetype === 'section-opener' || slide.slideRole === 'context' || slide.visualStructure === 'message-emphasis') {
    return 'section';
  }
  return 'content';
}

function getLayoutRationale(
  classification: SlideContentClassification,
  visualStructure: SlideVisualStructure,
): string {
  const labels: Record<SlideContentClassification, string> = {
    comparison: 'contrasts alternatives or states',
    process: 'explains a sequence of actions',
    timeline: 'shows time-based milestones',
    structure: 'maps a system or capability model',
    data: 'interprets measures or evidence',
    case: 'shows a concrete situation and outcome',
    message: 'emphasizes one decision-ready message',
  };
  return `Classified as ${classification} because the content ${labels[classification]}; selected ${visualStructure}.`;
}

function getSlideSearchText(
  slide: Pick<SlidePlan, 'title' | 'mainMessage' | 'contentBlocks'>,
): string {
  const contentBlocks = Array.isArray(slide.contentBlocks) ? slide.contentBlocks : [];
  return [slide.title, slide.mainMessage, ...contentBlocks.flatMap((block) => [block.heading, block.detail])].join(' ');
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
  /\bMoves From Insight To\b/iu,
  /\bSlide Title\b/iu,
  /\bKey Point\b/iu,
  /\bLorem ipsum\b/iu,
];

const HANGUL_CHARACTER_PATTERN = /[\u3131-\u318e\uac00-\ud7a3]/u;
const GENERIC_TITLES = new Set([
  'overview',
  'introduction',
  'summary',
  'conclusion',
  '\uac1c\uc694',
  '\uc18c\uac1c',
  '\uc694\uc57d',
  '\uacb0\ub860',
]);

const ENGLISH_CONCLUSION_TITLE_PATTERN = /\b(?:enables?|improves?|reduces?|builds?|turns?|creates?|makes?|helps?|accelerates?|protects?|strengthens?|increases?|lowers?|drives?|requires?|starts?|ends?|matters?|moves?|approves?|adopts?|chooses?|commits?|confirms?|prioritizes?|invests?|launches?|scales?|is|are|can|will|must|should)\b/iu;
const GENERIC_MESSAGE_HEADLINE_PATTERN = /^(?:teams|people|organizations|businesses)\s+(?:move|work|decide|perform|learn)\b/iu;
const KOREAN_CONCLUSION_TITLE_PATTERN = /(?:\ud569\ub2c8\ub2e4|\ub429\ub2c8\ub2e4|\ud574\uc57c|\ud544\uc694\ud569\ub2c8\ub2e4|\ub192\uc785\ub2c8\ub2e4|\ub0ae\ucd99\ub2c8\ub2e4|\ub9cc\ub4ed\ub2c8\ub2e4|\ubc14\uafc9\ub2c8\ub2e4|\uc5f0\uacb0\ud569\ub2c8\ub2e4|\ud655\ub300\ud569\ub2c8\ub2e4|\uc2dc\uc791\ud569\ub2c8\ub2e4|\ud575\uc2ec\uc785\ub2c8\ub2e4|\uc911\uc694\ud569\ub2c8\ub2e4)$/u;

const TEXT_LENGTH_LIMITS = {
  Korean: {
    title: 22,
    subtitle: 44,
    objective: 66,
    mainMessage: 80,
    heading: 18,
    takeaway: 86,
  },
  English: {
    title: 42,
    subtitle: 76,
    objective: 120,
    mainMessage: 150,
    heading: 30,
    takeaway: 160,
  },
} as const;

const DETAIL_LENGTH_LIMITS: Record<ContentDensity, Record<TargetLanguage, number>> = {
  light: { Korean: 64, English: 116 },
  standard: { Korean: 46, English: 84 },
  detailed: { Korean: 34, English: 62 },
};

type CopyQaScope = 'deck' | 'section';

export function compressDeckCopyForLayout(deckPlan: PptDeckPlan): PptDeckPlan {
  return {
    ...deckPlan,
    slides: deckPlan.slides.map((slide) =>
      compressSlideCopyForLayout(slide, deckPlan.request.targetLanguage, deckPlan.request.contentDensity),
    ),
  };
}

export function compressSlideCopyForLayout(
  slide: SlidePlan,
  language: TargetLanguage,
  contentDensity: ContentDensity | undefined,
): SlidePlan {
  const limits = TEXT_LENGTH_LIMITS[language];
  const detailLimit = DETAIL_LENGTH_LIMITS[contentDensity ?? 'light'][language];
  const contentBlocks = (slide.contentBlocks ?? []).map((block) => ({
    heading: compactEditableCopy(block.heading, limits.heading),
    detail: compactEditableCopy(block.detail, detailLimit),
  }));
  const mainMessage = compactEditableCopy(slide.mainMessage, limits.mainMessage);
  const compactedTitle = compactEditableCopy(slide.title, limits.title);
  const comparisonTable = slide.comparisonTable
    ? {
      ...slide.comparisonTable,
      rationale: compactEditableCopy(slide.comparisonTable.rationale, detailLimit),
      columnHeaders: slide.comparisonTable.columnHeaders.slice(0, 3).map((header) => compactEditableCopy(header, limits.heading)),
      rows: slide.comparisonTable.rows.slice(0, 5).map((row) => ({
        ...row,
        criterion: compactEditableCopy(row.criterion, limits.heading),
        values: row.values.slice(0, 2).map((value) => compactEditableCopy(value, detailLimit)),
      })),
      keyResult: compactEditableCopy(slide.comparisonTable.keyResult, limits.takeaway),
    }
    : undefined;
  const chart = slide.chart
    ? {
      ...slide.chart,
      rationale: compactEditableCopy(slide.chart.rationale, detailLimit),
      series: slide.chart.series.slice(0, 6).map((item) => ({
        ...item,
        label: compactEditableCopy(item.label, limits.heading),
      })),
      keyResult: compactEditableCopy(slide.chart.keyResult, limits.takeaway),
    }
    : undefined;
  const keyMetric = slide.keyMetric
    ? {
      ...slide.keyMetric,
      label: compactEditableCopy(slide.keyMetric.label, limits.heading),
      displayValue: compactEditableCopy(slide.keyMetric.displayValue, Math.max(12, Math.min(limits.heading, 24))),
      changeText: slide.keyMetric.changeText
        ? compactEditableCopy(slide.keyMetric.changeText, Math.max(12, Math.min(limits.heading, 24)))
        : null,
      comparisonText: compactEditableCopy(slide.keyMetric.comparisonText, detailLimit),
      rationale: compactEditableCopy(slide.keyMetric.rationale, detailLimit),
    }
    : undefined;

  return {
    ...slide,
    title: improveSlideTitle(compactedTitle, mainMessage, language),
    subtitle: compactEditableCopy(slide.subtitle, limits.subtitle),
    objective: compactEditableCopy(slide.objective, limits.objective),
    mainMessage,
    labels: contentBlocks.length > 0
      ? contentBlocks.map((block) => block.heading)
      : (slide.labels ?? []).map((label) => compactEditableCopy(label, limits.heading)),
    contentBlocks,
    decision: compactEditableCopy(slide.decision, limits.takeaway),
    takeaway: compactEditableCopy(slide.takeaway, limits.takeaway),
    comparisonTable,
    chart,
    keyMetric,
  };
}

export function compactEditableCopy(value: string, maxLength: number): string {
  const normalized = stripEllipsis(value).replace(/\s+/g, ' ').trim();
  if (getTextLength(normalized) <= maxLength) return normalized;

  const sentences = normalized
    .match(/[^.!?。！？]+[.!?。！？]?/gu)
    ?.map((sentence) => sentence.trim())
    .filter(Boolean) ?? [];
  const firstSentence = sentences[0] ?? '';
  if (firstSentence && getTextLength(firstSentence) <= maxLength) {
    return stripEllipsis(firstSentence);
  }

  return cutCopyAtNaturalBoundary(normalized, maxLength);
}

function cutCopyAtNaturalBoundary(value: string, maxLength: number): string {
  const shortened = Array.from(value).slice(0, maxLength).join('').trim();
  if (!shortened) return '';

  const boundaryIndex = [
    shortened.lastIndexOf(' '),
    shortened.lastIndexOf(','),
    shortened.lastIndexOf(';'),
    shortened.lastIndexOf(':'),
    shortened.lastIndexOf('·'),
  ].reduce((best, index) => Math.max(best, index), -1);

  if (boundaryIndex >= Math.floor(maxLength * 0.55)) {
    return stripEllipsis(shortened.slice(0, boundaryIndex).trim());
  }

  return stripEllipsis(shortened);
}

export function getDeckCopyQaIssues(
  deckPlan: Pick<PptDeckPlan, 'request' | 'slides'>,
  scope: CopyQaScope = 'deck',
): string[] {
  const issues: string[] = [];

  deckPlan.slides.forEach((slide) => {
    const labels = slide.labels ?? [];
    const contentBlocks = slide.contentBlocks ?? [];
    const fields = [
      slide.title,
      slide.subtitle,
      slide.objective,
      slide.mainMessage,
      slide.decision,
      slide.takeaway,
      ...labels,
      ...contentBlocks.flatMap((block) => [block.heading, block.detail]),
    ];
    fields.forEach((value) => {
      const text = typeof value === 'string' ? value.trim() : '';
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

    if (!slide.objective || !slide.decision) {
      issues.push(`Slide ${slide.pageNumber} is missing a planning objective or recommended decision.`);
    }
    if (isGenericSlideTitle(slide.title)) {
      issues.push(`Slide ${slide.pageNumber} needs a decision-oriented title instead of "${slide.title}".`);
    } else if (isTopicOnlySlideTitle(slide.title, deckPlan.request.targetLanguage)) {
      issues.push(`Slide ${slide.pageNumber} title must state the slide conclusion instead of the topic "${slide.title}".`);
    }
    if (contentBlocks.length < 3) {
      issues.push(`Slide ${slide.pageNumber} needs at least three supporting proof points.`);
    }
    if (!contentBlocks.every((block) => block.heading && block.detail)) {
      issues.push(`Slide ${slide.pageNumber} contains an incomplete supporting proof point.`);
    }
    if (!labels.every((label, index) => label === contentBlocks[index]?.heading)) {
      issues.push(`Slide ${slide.pageNumber} labels must mirror the supporting proof point headings.`);
    }
    issues.push(...getSlideTextLengthIssues(slide, deckPlan.request.targetLanguage, deckPlan.request.contentDensity));
  });

  reportRepeatedSlideCopy(deckPlan.slides, issues);

  if (scope === 'deck') {
    const structures = deckPlan.slides.map((slide) => slide.visualStructure);
    const requiredDistinctStructures = Math.min(deckPlan.slides.length, 4);
    if (new Set(structures).size < requiredDistinctStructures) {
      issues.push(`Deck needs at least ${requiredDistinctStructures} distinct visual structures.`);
    }
    structures.forEach((structure, index) => {
      if (index > 0 && structure === structures[index - 1]) {
        issues.push(`Slides ${index} and ${index + 1} repeat the same visual structure.`);
      }
      if (index > 0 && getLayoutFamily(structure) === getLayoutFamily(structures[index - 1])) {
        issues.push(`Slides ${index} and ${index + 1} repeat the same layout family.`);
      }
    });
  }

  return Array.from(new Set(issues));
}

export function getDeckRedundancySuggestions(
  slides: Pick<SlidePlan, 'pageNumber' | 'title' | 'mainMessage' | 'contentBlocks' | 'visualStructure'>[],
): PptRedundancySuggestion[] {
  const suggestions: PptRedundancySuggestion[] = [];
  const orderedSlides = [...slides].sort((left, right) => left.pageNumber - right.pageNumber);

  for (let leftIndex = 0; leftIndex < orderedSlides.length; leftIndex += 1) {
    for (let rightIndex = leftIndex + 1; rightIndex < orderedSlides.length; rightIndex += 1) {
      const left = orderedSlides[leftIndex];
      const right = orderedSlides[rightIndex];
      const titleSimilarity = getCopySimilarity(left.title, right.title);
      const messageSimilarity = getCopySimilarity(left.mainMessage, right.mainMessage);
      const caseSimilarity = getCopySimilarity(
        left.contentBlocks.flatMap((block) => [block.heading, block.detail]).join(' '),
        right.contentBlocks.flatMap((block) => [block.heading, block.detail]).join(' '),
      );
      const usesSimilarDiagram = left.visualStructure === right.visualStructure && Math.max(titleSimilarity, messageSimilarity) >= 0.42;
      const slideNumbers: [number, number] = [left.pageNumber, right.pageNumber];

      if (titleSimilarity >= 0.82 && messageSimilarity >= 0.72) {
        suggestions.push(createRedundancySuggestion(slideNumbers, 'message', 'remove', Math.max(titleSimilarity, messageSimilarity)));
      } else if (titleSimilarity >= 0.5 || caseSimilarity >= 0.66) {
        suggestions.push(createRedundancySuggestion(slideNumbers, titleSimilarity >= 0.5 ? 'title' : 'case', 'merge', Math.max(titleSimilarity, caseSimilarity)));
      } else if (messageSimilarity >= 0.54 || usesSimilarDiagram) {
        suggestions.push(createRedundancySuggestion(slideNumbers, usesSimilarDiagram ? 'diagram' : 'message', 'separate-role', Math.max(messageSimilarity, titleSimilarity)));
      }
    }
  }

  return suggestions
    .sort((left, right) => right.confidence - left.confidence)
    .filter((suggestion, index, all) =>
      all.findIndex((candidate) => candidate.id === suggestion.id) === index,
    );
}

export function getDeckCoverageSuggestions(
  slides: Pick<SlidePlan, 'pageNumber' | 'title' | 'mainMessage' | 'contentBlocks' | 'visualStructure' | 'slideRole'>[],
): PptCoverageSuggestion[] {
  const problemSlides = slides.filter((slide) =>
    slide.slideRole === 'problem-framing' || includesCoverageSignal(slide, PROBLEM_SIGNAL_PATTERN),
  );
  if (problemSlides.length === 0) return [];

  const hasSolution = slides.some((slide) =>
    slide.slideRole === 'solution' ||
    slide.slideRole === 'implementation' ||
    includesCoverageSignal(slide, SOLUTION_SIGNAL_PATTERN),
  );
  const hasFeature = slides.some((slide) => {
    const blockCount = Array.isArray(slide.contentBlocks) ? slide.contentBlocks.length : 0;
    return (
      ((slide.slideRole === 'solution' || slide.slideRole === 'implementation') && blockCount >= 3) ||
      includesCoverageSignal(slide, FEATURE_SIGNAL_PATTERN)
    );
  });
  const hasKpi = slides.some((slide) =>
    slide.visualStructure === 'metrics-dashboard' ||
    includesCoverageSignal(slide, KPI_SIGNAL_PATTERN),
  );
  const hasImpact = slides.some((slide) =>
    (slide.slideRole === 'decision' || slide.slideRole === 'conclusion') &&
    includesCoverageSignal(slide, IMPACT_SIGNAL_PATTERN),
  );
  const problemSlideNumbers = problemSlides.map((slide) => slide.pageNumber);
  const suggestions: PptCoverageSuggestion[] = [];

  if (!hasSolution) {
    suggestions.push(createCoverageSuggestion(
      problemSlideNumbers,
      'solution',
      'required',
      'solution',
      'card-grid',
      'A stated problem has no corresponding solution. Add a solution slide that directly answers the problem and names the proposed approach.',
    ));
  }
  if (hasSolution && !hasFeature) {
    suggestions.push(createCoverageSuggestion(
      problemSlideNumbers,
      'feature',
      'recommended',
      'solution',
      'hub-and-spoke',
      'The solution is named, but its concrete functions or capabilities are not explained. Add the 3-5 capabilities that make the solution usable.',
    ));
  }
  if (!hasKpi) {
    suggestions.push(createCoverageSuggestion(
      problemSlideNumbers,
      'kpi',
      'recommended',
      'evidence',
      'metrics-dashboard',
      'No success measure is defined. Add source-backed KPIs, targets, or qualitative review criteria that show whether the solution is working.',
    ));
  }
  if (!hasImpact) {
    suggestions.push(createCoverageSuggestion(
      problemSlideNumbers,
      'impact',
      'required',
      'conclusion',
      'closing-commitment',
      'The expected effect is not explicit. Add the operational, customer, learning, or financial outcome the audience should expect after implementation.',
    ));
  }

  return suggestions;
}

const PROBLEM_SIGNAL_PATTERN = /\b(?:problem|challenge|pain|risk|gap|issue|barrier)\b|문제|과제|한계|위험|격차|어려움/u;
const SOLUTION_SIGNAL_PATTERN = /\b(?:solution|solve|approach|proposal|recommend|roadmap|implementation)\b|해결|방안|제안|실행|도입/u;
const FEATURE_SIGNAL_PATTERN = /\b(?:feature|capability|function|workflow|process|module)\b|기능|역량|체계|프로세스|모듈/u;
const KPI_SIGNAL_PATTERN = /\b(?:kpi|metric|measure|target|baseline|roi|okr)\b|성과|지표|측정|목표|기준/u;
const IMPACT_SIGNAL_PATTERN = /\b(?:impact|outcome|benefit|value|result|effect|expected)\b|효과|기대|성과|가치|결과|개선/u;

function includesCoverageSignal(
  slide: Pick<SlidePlan, 'title' | 'mainMessage' | 'contentBlocks'>,
  pattern: RegExp,
): boolean {
  const supportCopy = Array.isArray(slide.contentBlocks)
    ? slide.contentBlocks.flatMap((block) => [block.heading, block.detail]).join(' ')
    : '';
  return pattern.test([slide.title, slide.mainMessage, supportCopy].join(' '));
}

function createCoverageSuggestion(
  problemSlideNumbers: number[],
  kind: PptCoverageSuggestion['kind'],
  severity: PptCoverageSuggestion['severity'],
  recommendedSlideRole: PptCoverageSuggestion['recommendedSlideRole'],
  recommendedVisualStructure: PptCoverageSuggestion['recommendedVisualStructure'],
  summary: string,
): PptCoverageSuggestion {
  return {
    id: `coverage-${kind}-after-${problemSlideNumbers.join('-')}`,
    problemSlideNumbers,
    kind,
    severity,
    recommendedSlideRole,
    recommendedVisualStructure,
    summary,
  };
}

function createRedundancySuggestion(
  slideNumbers: [number, number],
  kind: PptRedundancySuggestion['kind'],
  action: PptRedundancySuggestion['action'],
  confidence: number,
): PptRedundancySuggestion {
  const actionSummary: Record<PptRedundancySuggestion['action'], string> = {
    merge: 'Combine overlapping evidence into one stronger slide, then use the released slide for a missing question.',
    remove: 'Keep the clearer slide and remove the duplicate after confirming no unique source or decision is lost.',
    'separate-role': 'Keep both slides only if one explains the evidence and the other turns it into a decision, comparison, or next action.',
  };

  return {
    id: `${kind}-${action}-${slideNumbers[0]}-${slideNumbers[1]}`,
    slideNumbers,
    kind,
    action,
    confidence: Math.round(confidence * 100),
    summary: actionSummary[action],
  };
}

function getCopySimilarity(left: string, right: string): number {
  const leftTokens = getMeaningfulTokens(left);
  const rightTokens = getMeaningfulTokens(right);
  if (leftTokens.size === 0 || rightTokens.size === 0) return 0;

  const intersection = [...leftTokens].filter((token) => rightTokens.has(token)).length;
  return intersection / new Set([...leftTokens, ...rightTokens]).size;
}

function getMeaningfulTokens(value: string): Set<string> {
  return new Set(
    value
      .toLocaleLowerCase()
      .match(/[\p{L}\p{N}]+/gu)
      ?.filter((token) => token.length > 1 && !EN_STOP_WORDS.has(token)) ?? [],
  );
}

function getSlideTextLengthIssues(
  slide: Pick<SlidePlan, 'pageNumber' | 'title' | 'subtitle' | 'objective' | 'mainMessage' | 'decision' | 'takeaway' | 'contentBlocks'>,
  language: TargetLanguage,
  contentDensity: ContentDensity | undefined,
): string[] {
  const limits = TEXT_LENGTH_LIMITS[language];
  const detailLimit = DETAIL_LENGTH_LIMITS[contentDensity ?? 'light'][language];
  const fields: Array<[string, string, number]> = [
    ['title', slide.title, limits.title],
    ['subtitle', slide.subtitle, limits.subtitle],
    ['objective', slide.objective, limits.objective],
    ['main message', slide.mainMessage, limits.mainMessage],
    ['decision', slide.decision, limits.takeaway],
    ['takeaway', slide.takeaway, limits.takeaway],
  ];
  const issues = fields
    .filter(([, value, limit]) => getTextLength(value) > limit)
    .map(([field, , limit]) => `Slide ${slide.pageNumber} ${field} exceeds the ${limit}-character editable layout limit.`);

  const contentBlocks = Array.isArray(slide.contentBlocks) ? slide.contentBlocks : [];
  contentBlocks.forEach((block, index) => {
    if (getTextLength(block.heading) > limits.heading) {
      issues.push(`Slide ${slide.pageNumber} proof point ${index + 1} heading exceeds the ${limits.heading}-character editable layout limit.`);
    }
    if (getTextLength(block.detail) > detailLimit) {
      issues.push(`Slide ${slide.pageNumber} proof point ${index + 1} detail exceeds the ${detailLimit}-character editable layout limit for ${contentDensity ?? 'light'} density.`);
    }
  });

  return issues;
}

function getTextLength(value: unknown): number {
  return typeof value === 'string' ? Array.from(value).length : 0;
}

function isGenericSlideTitle(value: string): boolean {
  return GENERIC_TITLES.has(normalizeCopyKey(value));
}

export function improveSlideTitle(
  title: string,
  mainMessage: string,
  language: TargetLanguage,
): string {
  const normalizedTitle = title.replace(/\s+/g, ' ').trim();
  if (!isTopicOnlySlideTitle(normalizedTitle, language)) return normalizedTitle;

  const limit = TEXT_LENGTH_LIMITS[language].title;
  const messageCandidate = getConciseMessageHeadline(mainMessage, language);
  if (messageCandidate && getTextLength(messageCandidate) <= limit && !isTopicOnlySlideTitle(messageCandidate, language) && !isGenericMessageHeadline(messageCandidate)) {
    return messageCandidate;
  }

  if (language === 'Korean') {
    const topic = limitWords(normalizedTitle, 10);
    return topic
      ? `${withKoreanInstrumentalParticle(topic)} \uc2e4\ud589\ub825\uc744 \ub192\uc785\ub2c8\ub2e4`
      : '\ud575\uc2ec \uadfc\uac70\ub85c \uc2e4\ud589\ub825\uc744 \ub192\uc785\ub2c8\ub2e4';
  }

  const suffix = ' Enables Better Decisions';
  const topic = limitWords(normalizedTitle, limit - suffix.length);
  return topic ? `${topic}${suffix}` : 'Evidence Enables Better Decisions';
}

function isTopicOnlySlideTitle(value: string, language: TargetLanguage): boolean {
  const title = value.replace(/\s+/g, ' ').trim();
  if (!title) return false;
  if (isGenericSlideTitle(title)) return true;
  if (/\bQLEARN(?:\s+for\s+Startup)?\b/iu.test(title)) return false;

  if (language === 'English') {
    const wordCount = title.split(/\s+/u).filter(Boolean).length;
    return wordCount <= 6 && !ENGLISH_CONCLUSION_TITLE_PATTERN.test(title);
  }

  return getTextLength(title) <= 18 && !KOREAN_CONCLUSION_TITLE_PATTERN.test(title);
}

function getConciseMessageHeadline(value: string, language: TargetLanguage): string | null {
  const sentence = value.replace(/\s+/g, ' ').split(/[.!?]/u)[0]?.trim() ?? '';
  if (!sentence) return null;

  if (language === 'English') {
    return sentence
      .replace(/\s+\b(?:when|because|while|by|as)\b\s+.*$/iu, '')
      .replace(/\s+\b(?:across|throughout|within)\b\s+.*$/iu, '')
      .trim();
  }

  return sentence;
}

function isGenericMessageHeadline(value: string): boolean {
  return GENERIC_MESSAGE_HEADLINE_PATTERN.test(value.trim());
}

function limitWords(value: string, limit: number): string {
  if (limit <= 0) return '';
  const words = value.split(/\s+/u).filter(Boolean);
  let result = '';
  for (const word of words) {
    const candidate = result ? `${result} ${word}` : word;
    if (getTextLength(candidate) > limit) break;
    result = candidate;
  }
  return result;
}

function withKoreanInstrumentalParticle(value: string): string {
  const lastCharacter = Array.from(value).at(-1);
  if (!lastCharacter) return value;

  const characterCode = lastCharacter.codePointAt(0);
  if (characterCode === undefined || characterCode < 0xac00 || characterCode > 0xd7a3) {
    return `${value}\uc73c\ub85c`;
  }

  const finalConsonant = (characterCode - 0xac00) % 28;
  return `${value}${finalConsonant !== 0 && finalConsonant !== 8 ? '\uc73c\ub85c' : '\ub85c'}`;
}

function reportRepeatedSlideCopy(
  slides: Pick<PptDeckPlan['slides'][number], 'pageNumber' | 'title' | 'mainMessage'>[],
  issues: string[],
): void {
  const titles = new Map<string, number>();
  const messages = new Map<string, number>();

  slides.forEach((slide) => {
    const titleKey = normalizeCopyKey(slide.title);
    const messageKey = normalizeCopyKey(slide.mainMessage);
    if (titleKey) {
      const priorPage = titles.get(titleKey);
      if (priorPage) issues.push(`Slides ${priorPage} and ${slide.pageNumber} repeat the same title.`);
      else titles.set(titleKey, slide.pageNumber);
    }
    if (messageKey) {
      const priorPage = messages.get(messageKey);
      if (priorPage) issues.push(`Slides ${priorPage} and ${slide.pageNumber} repeat the same main message.`);
      else messages.set(messageKey, slide.pageNumber);
    }
  });
}

function normalizeCopyKey(value: string): string {
  return value
    .toLocaleLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function getDeckAssemblyQaIssues(
  deckPlan: Pick<PptDeckPlan, 'request' | 'slides' | 'blueprint'>,
): string[] {
  const issues: string[] = [];
  const expectedSlideCount = deckPlan.request.slideCount;
  const slides = [...deckPlan.slides].sort((left, right) => left.pageNumber - right.pageNumber);

  if (slides.length !== expectedSlideCount) {
    issues.push(`Deck assembly expected ${expectedSlideCount} slides but received ${slides.length}.`);
  }

  Array.from({ length: expectedSlideCount }, (_, index) => index + 1).forEach((pageNumber, index) => {
    if (slides[index]?.pageNumber !== pageNumber) {
      issues.push(`Deck assembly requires page ${pageNumber} exactly once and in order.`);
    }
  });

  if (slides[0]?.visualStructure !== 'hero-visual') {
    issues.push('Deck assembly requires slide 1 to use hero-visual.');
  }
  if (expectedSlideCount > 1 && slides.at(-1)?.visualStructure !== 'closing-commitment') {
    issues.push(`Deck assembly requires slide ${expectedSlideCount} to use closing-commitment.`);
  }

  const requiresDependencyValidation = Boolean(deckPlan.request.deckBlueprint) || slides.some((slide) => Boolean(slide.dependency));
  if (requiresDependencyValidation) {
    slides.forEach((slide, index) => {
      const previousSlide = slides[index - 1];
      const expectedPreviousSlideNumber = previousSlide?.pageNumber ?? null;
      const dependency = slide.dependency;
      if (!dependency) {
        issues.push(`Slide ${slide.pageNumber} is missing a narrative dependency.`);
        return;
      }
      if (dependency.previousSlideNumber !== expectedPreviousSlideNumber) {
        issues.push(`Slide ${slide.pageNumber} does not link to its direct predecessor.`);
      }
      if (!dependency.questionAddressed || !dependency.answerSummary) {
        issues.push(`Slide ${slide.pageNumber} has an incomplete narrative dependency.`);
      }
      if (previousSlide && previousSlide.dependency?.nextQuestion !== dependency.questionAddressed) {
        issues.push(`Slide ${slide.pageNumber} does not resolve the question handed off by slide ${previousSlide.pageNumber}.`);
      }
      if (index === slides.length - 1 && dependency.nextQuestion !== null) {
        issues.push(`Slide ${slide.pageNumber} must close the narrative without another question.`);
      }
      if (index < slides.length - 1 && !dependency.nextQuestion) {
        issues.push(`Slide ${slide.pageNumber} must hand off one question to the next slide.`);
      }
    });
  }

  deckPlan.blueprint?.sections.forEach((section) => {
    const sectionSlides = slides.filter((slide) =>
      slide.pageNumber >= section.slideStart && slide.pageNumber < section.slideStart + section.slideCount
    );
    if (sectionSlides.length !== section.slideCount) {
      issues.push(`Section "${section.title}" is missing one or more planned pages.`);
    }
    if (section.visualFocus.length > 0 && !sectionSlides.some((slide) => section.visualFocus.includes(slide.visualStructure))) {
      issues.push(`Section "${section.title}" does not apply its Blueprint visual direction.`);
    }
  });

  return Array.from(new Set(issues));
}

export function linkSlideDependencies(slides: SlidePlan[]): SlidePlan[] {
  const orderedSlides = [...slides].sort((left, right) => left.pageNumber - right.pageNumber);

  return orderedSlides.map((slide, index) => {
    const nextSlide = orderedSlides[index + 1];
    const questionAddressed = getDependencyQuestion(slide);
    const nextQuestion = nextSlide ? getDependencyQuestion(nextSlide) : null;

    return {
      ...slide,
      dependency: {
        previousSlideNumber: orderedSlides[index - 1]?.pageNumber ?? null,
        questionAddressed,
        answerSummary: slide.dependency?.answerSummary?.trim() || slide.mainMessage,
        nextQuestion,
      },
    };
  });
}

function getDependencyQuestion(slide: SlidePlan): string {
  return slide.dependency?.questionAddressed?.trim() || slide.objective.trim() || slide.mainMessage.trim();
}

function hasUnapprovedLatinCopy(value: string): boolean {
  const withoutApprovedBrandNames = value
    .replace(/\bQLEARN\s+for\s+Startup\b/giu, 'QLEARN')
    .replace(/\bQLEARN\s+Startup\b/giu, 'QLEARN');
  const tokens = withoutApprovedBrandNames.match(/[A-Za-z][A-Za-z0-9]*(?:[&+./-][A-Za-z0-9]+)*/g) ?? [];
  return tokens.some((token) => !isApprovedKoreanDeckLatinToken(token));
}

function isApprovedKoreanDeckLatinToken(token: string): boolean {
  const approvedTerms = new Set(['AI', 'QLEARN', 'PPT', 'CTO', 'CEO', 'SaaS', 'PoC']);
  if (approvedTerms.has(token)) return true;

  const uppercaseAbbreviation = /^[A-Z][A-Z0-9]*(?:[&+./-][A-Z0-9]+)*$/u;
  const alphanumericLength = token.replace(/[^A-Z0-9]/gu, '').length;
  return uppercaseAbbreviation.test(token) && alphanumericLength >= 2;
}

export function stripEllipsis(value: string): string {
  return value.replace(/\.{2,}|…/g, '').replace(/\s+/g, ' ').trim();
}
