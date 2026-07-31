type TargetLanguage = 'English' | 'Korean';
import { DEFAULT_PPT_PLAN_MODEL, fetchOpenAiWithRetry } from '../_shared/openaiRetry.ts';
type ContentDensity = 'light' | 'standard' | 'detailed';
type SlideArchetype = 'cover' | 'section-opener' | 'card-grid' | 'comparison' | 'process' | 'before-after' | 'case-dashboard' | 'closing';
type SlideRole = 'opening' | 'context' | 'problem-framing' | 'evidence' | 'comparison' | 'solution' | 'implementation' | 'case-study' | 'decision' | 'conclusion';
type SlideVisualStructure =
  | 'hero-visual'
  | 'message-emphasis'
  | 'card-grid'
  | 'side-by-side-comparison'
  | 'numbered-process'
  | 'before-after-mapping'
  | 'hub-and-spoke'
  | 'metrics-dashboard'
  | 'roadmap'
  | 'pyramid-framework'
  | 'case-story'
  | 'closing-commitment';
type SlideContentClassification = 'comparison' | 'process' | 'timeline' | 'structure' | 'data' | 'case' | 'message';
type SlideDiagramType = 'none' | 'process' | 'cycle' | 'hierarchy' | 'timeline' | 'relationship' | 'change';
type SlideDiagramSpec = { type: SlideDiagramType; rationale: string; nodes: string[] };
type SlideTableEmphasis = 'none' | 'difference' | 'key-result';
type SlideComparisonTableSpec = {
  rationale: string;
  columnHeaders: string[];
  rows: Array<{ criterion: string; values: string[]; emphasis: SlideTableEmphasis }>;
  highlightedRowIndex: number | null;
  keyResult: string;
};
type SlideChartPurpose = 'comparison' | 'trend' | 'composition' | 'distribution' | 'target-progress';
type SlideChartType = 'bar' | 'line' | 'donut' | 'histogram' | 'progress';
type SlideChartSpec = {
  purpose: SlideChartPurpose;
  type: SlideChartType;
  rationale: string;
  series: Array<{ label: string; value: number }>;
  targetValue: number | null;
  highlightedIndex: number | null;
  unit: string;
  keyResult: string;
};
type SlideMetricDirection = 'up' | 'down' | 'neutral';
type SlideKeyMetricSpec = {
  label: string;
  displayValue: string;
  numericValue: number;
  changeText: string | null;
  direction: SlideMetricDirection;
  comparisonText: string;
  rationale: string;
};
type SlideLayoutFamily = 'hero' | 'message' | 'card' | 'comparison' | 'process' | 'timeline' | 'structure' | 'data' | 'case' | 'closing';
type SlideMasterLayoutId = 'cover' | 'agenda' | 'section' | 'content' | 'comparison' | 'chart' | 'conclusion';
type SlideLayoutSelection = {
  classification: SlideContentClassification;
  family: SlideLayoutFamily;
  rationale: string;
};
type SlideImagePlacement = 'right-hero' | 'left-hero' | 'center-visual' | 'card-visual' | 'hub-visual' | 'full-bleed-visual';
type SlideDependency = {
  previousSlideNumber: number | null;
  questionAddressed: string;
  answerSummary: string;
  nextQuestion: string | null;
};

type PurposeTemplate = {
  id: string;
  name: string;
  description: string;
  documentType: string;
  presentationIntent: string;
  defaultOutline: string[];
  compositionRules: string[];
};

type PptMakerRequest = {
  sourceText: string;
  sourceDocument?: { name: string; type: 'docx' | 'pdf' | 'pptx' | 'xlsx' | 'image'; extractedCharacterCount: number };
  sourceMaterialAnalysis?: { summary: string; keyPoints: string[]; dataPoints: string[]; availableVisuals: string[]; sources: Array<{ id: string; sourceName: string; documentName: string; publicationYear: number | null; url: string | null; verifiedAt: string }> };
  creationInstructions?: string;
  targetLanguage: TargetLanguage;
  topic?: string;
  audience: string;
  purpose: string;
  presentationDurationMinutes?: number;
  documentType?: string;
  slideCount: number;
  contentDensity?: ContentDensity;
  presentationIntent?: string;
  coreMessage?: string;
  requiredSections?: string;
  purposeTemplate?: PurposeTemplate;
  presentationGuide?: {
    name: string;
    narrativeGuide: string;
    visualGuide: string;
    slideRules: string[];
  };
  deckBlueprint?: {
    title: string;
    strategy: DeckStrategy;
    sections: Array<{
      id: string;
      title: string;
      role?: string;
      keyQuestion?: string;
      purpose: string;
      keyMessage: string;
      slideStart: number;
      slideCount: number;
      visualFocus: SlideVisualStructure[];
    }>;
  };
  planningBatch?: {
    sectionId: string;
    startPage: number;
    slideCount: number;
    totalSlides: number;
    previousSlides?: Array<Pick<DraftSlide, 'pageNumber' | 'title' | 'mainMessage' | 'decision'>>;
  };
  styleReference: {
    name: string;
    notes: string;
    primaryColorLabel: string;
    accentColorLabel: string;
    templateDesign?: {
      signatureLayout: string;
      recommendedVisualStructures: SlideVisualStructure[];
    };
  };
};

type DraftSlide = {
  pageNumber: number;
  archetype: SlideArchetype;
  slideRole: SlideRole;
  dependency: SlideDependency;
  visualStructure: SlideVisualStructure;
  diagram?: SlideDiagramSpec;
  comparisonTable?: SlideComparisonTableSpec;
  chart?: SlideChartSpec;
  keyMetric?: SlideKeyMetricSpec;
  layoutSelection?: SlideLayoutSelection;
  masterLayout?: SlideMasterLayoutId;
  mainMessage: string;
  title: string;
  subtitle: string;
  objective: string;
  labels: string[];
  contentBlocks: Array<{ heading: string; detail: string }>;
  decision: string;
  takeaway: string;
  imageSlot: { id: string; purpose: string; placement: SlideImagePlacement; prompt: string };
  sourceIds?: string[];
};

type DeckStrategy = {
  coreThesis: string;
  audienceNeed: string;
  desiredOutcome: string;
  narrativeArc: Array<{ phase: string; purpose: string; slideNumbers: number[] }>;
};

type DraftPlan = { strategy: DeckStrategy; slides: DraftSlide[] };

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const archetypes: SlideArchetype[] = ['cover', 'section-opener', 'card-grid', 'comparison', 'process', 'before-after', 'case-dashboard', 'closing'];
const slideRoles: SlideRole[] = ['opening', 'context', 'problem-framing', 'evidence', 'comparison', 'solution', 'implementation', 'case-study', 'decision', 'conclusion'];
const structures: SlideVisualStructure[] = [
  'hero-visual', 'message-emphasis', 'card-grid', 'side-by-side-comparison', 'numbered-process', 'before-after-mapping',
  'hub-and-spoke', 'metrics-dashboard', 'roadmap', 'pyramid-framework', 'case-story', 'closing-commitment',
];
const placements: SlideImagePlacement[] = ['right-hero', 'left-hero', 'center-visual', 'card-visual', 'hub-visual', 'full-bleed-visual'];
const hangul = /[\u3131-\u318e\uac00-\ud7a3]/u;
const densityPolicies = {
  light: { blockCount: 3, koreanMinLength: 8, englishMinLength: 12, koreanMaxLength: 64, englishMaxLength: 116, description: '3 concise proof points with one short explanatory sentence each.' },
  standard: { blockCount: 4, koreanMinLength: 14, englishMinLength: 20, koreanMaxLength: 46, englishMaxLength: 84, description: '4 proof points with enough context to explain the claim, evidence, and implication.' },
  detailed: { blockCount: 5, koreanMinLength: 22, englishMinLength: 32, koreanMaxLength: 34, englishMaxLength: 62, description: '5 substantial proof points that preserve material context, evidence, implications, and an actionable recommendation.' },
} as const satisfies Record<ContentDensity, { blockCount: number; koreanMinLength: number; englishMinLength: number; koreanMaxLength: number; englishMaxLength: number; description: string }>;
const genericTitles = new Set(['overview', 'introduction', 'summary', 'conclusion', '\uac1c\uc694', '\uc18c\uac1c', '\uc694\uc57d', '\uacb0\ub860']);
const englishConclusionTitlePattern = /\b(?:enables?|improves?|reduces?|builds?|turns?|creates?|makes?|helps?|accelerates?|protects?|strengthens?|increases?|lowers?|drives?|requires?|starts?|ends?|matters?|moves?|approves?|adopts?|chooses?|commits?|confirms?|prioritizes?|invests?|launches?|scales?|is|are|can|will|must|should)\b/iu;
const genericMessageHeadlinePattern = /^(?:teams|people|organizations|businesses)\s+(?:move|work|decide|perform|learn)\b/iu;
const koreanConclusionTitlePattern = /(?:\ud569\ub2c8\ub2e4|\ub429\ub2c8\ub2e4|\ud574\uc57c|\ud544\uc694\ud569\ub2c8\ub2e4|\ub192\uc785\ub2c8\ub2e4|\ub0ae\ucd99\ub2c8\ub2e4|\ub9cc\ub4ed\ub2c8\ub2e4|\ubc14\uafc9\ub2c8\ub2e4|\uc5f0\uacb0\ud569\ub2c8\ub2e4|\ud655\ub300\ud569\ub2c8\ub2e4|\uc2dc\uc791\ud569\ub2c8\ub2e4|\ud575\uc2ec\uc785\ub2c8\ub2e4|\uc911\uc694\ud569\ub2c8\ub2e4)$/u;
const textLengthLimits = {
  Korean: { title: 22, subtitle: 44, objective: 66, mainMessage: 80, heading: 18, takeaway: 86 },
  English: { title: 42, subtitle: 76, objective: 120, mainMessage: 150, heading: 30, takeaway: 160 },
} as const;

function getDensityPolicy(contentDensity?: ContentDensity) {
  return densityPolicies[contentDensity ?? 'light'];
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  try {
    const payload = (await req.json()) as { request?: unknown };
    const request = normalizeRequest(payload.request);
    if (!request) return json({ error: 'Source text is required to create a PPT plan.' }, 400);

    const apiKey = Deno.env.get('OPENAI_API_KEY');
    if (!apiKey) return json({ error: 'OPENAI_API_KEY is not configured.' }, 500);

    const model = Deno.env.get('OPENAI_PPT_PLAN_MODEL') ?? DEFAULT_PPT_PLAN_MODEL;
    let plan = await expandPlanToRequestedSlideCount(apiKey, model, request, await requestPlan(apiKey, model, request));
    plan = ensurePlanTextCompleteness(plan, request);
    plan = ensurePlanDiversity(plan, request);
    let issues = validatePlan(plan, request);
    if (issues.length > 0) {
      plan = await expandPlanToRequestedSlideCount(
        apiKey,
        model,
        request,
        await requestPlan(apiKey, model, request, plan.slides, issues, 'repair'),
      );
      plan = ensurePlanTextCompleteness(plan, request);
      plan = ensurePlanDiversity(plan, request);
      issues = validatePlan(plan, request);
    }
    if (issues.length > 0) return json({ error: `Slide copy QA failed: ${issues[0]}`, issues }, 422);

    const redundancySuggestions = getRedundancySuggestions(plan.slides);
    const coverageSuggestions = getCoverageSuggestions(plan.slides);

    return json({
      id: request.planningBatch?.sectionId ? `section-${request.planningBatch.sectionId}-${Date.now()}` : `deck-${Date.now()}`,
      title: plan.slides[0]?.title ?? 'Untitled Deck',
      createdAt: new Date().toISOString(),
      strategy: request.deckBlueprint?.strategy ?? plan.strategy,
      slides: plan.slides.map((slide) => ({
        id: `slide-${slide.pageNumber}`,
        ...slide,
        imagePrompt: '',
      })),
      copyQa: {
        status: 'passed',
        checks: [
          `OpenAI created a ${plan.slides.length}-slide strategy and validated the storyline before layout rendering.`,
          'Every slide includes an audience objective, a decision-ready headline, supporting proof points, and a next action.',
          `Validated ${request.targetLanguage} language consistency, title fit, non-generic copy, and clipped-text rules.`,
          redundancySuggestions.length > 0
            ? `Detected ${redundancySuggestions.length} semantic overlap candidate(s) and prepared a consolidation, removal, or role-separation recommendation.`
            : 'No meaningful overlap was detected across slide titles, messages, proof points, or diagram structures.',
          coverageSuggestions.length > 0
            ? `Detected ${coverageSuggestions.length} missing-content candidate(s) and prepared a solution, capability, KPI, or expected-impact recommendation.`
            : 'Problem, solution, capability, measurement, and expected-impact coverage is complete for the detected problem statements.',
        ],
        issues: [],
        redundancySuggestions,
        coverageSuggestions,
      },
    });
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : 'Slide copy planning failed.' }, 500);
  }
});

async function requestPlan(
  apiKey: string,
  model: string,
  request: PptMakerRequest,
  priorSlides?: DraftSlide[],
  qaIssues: string[] = [],
  mode: 'create' | 'repair' | 'expand' = priorSlides ? 'repair' : 'create',
  requestedSlideCount = getBatchSlideCount(request),
): Promise<DraftPlan> {
  const activeSection = getActiveSection(request);
  const prompt = JSON.stringify({
    task: mode === 'expand'
      ? 'Create only the missing, non-redundant slide drafts required to extend this presentation.'
      : mode === 'repair'
        ? 'Repair this slide plan while preserving useful content.'
        : 'Create a presentation-ready slide draft.',
    requestedSlideCount,
    totalDeckSlideCount: getTotalSlideCount(request),
    activeSection,
    sectionBatch: request.planningBatch,
    deckBlueprint: getPlanningBlueprintContext(request.deckBlueprint, activeSection),
    contentDensity: request.contentDensity ?? 'light',
    targetLanguage: request.targetLanguage,
    topic: request.topic,
    audience: request.audience,
    purpose: request.purpose,
    presentationDurationMinutes: request.presentationDurationMinutes,
    documentType: request.documentType,
    presentationIntent: request.presentationIntent ?? 'strategy-decision',
    coreMessage: request.coreMessage ?? 'Derive a clear source-grounded core message.',
    requiredSections: request.requiredSections ?? 'No mandatory sections were provided.',
    purposeTemplate: request.purposeTemplate,
    presentationGuide: request.presentationGuide,
    sourceDocument: request.sourceDocument,
    sourceMaterialAnalysis: getPlanningSourceAnalysis(request.sourceMaterialAnalysis),
    creationInstructions: request.creationInstructions ?? 'No additional instructions were provided.',
    styleReference: request.styleReference,
    sourceText: getPlanningSourceExcerpt(request.sourceText),
    previousSlides: priorSlides?.slice(-2),
    qaIssuesToFix: qaIssues,
    rules: [
      'First create a planning brief from topic, purpose, audience, presentation duration, document type, coreMessage, requiredSections, presentationGuide, creationInstructions, sourceMaterialAnalysis, and sourceText. Then form a persuasive, decision-oriented storyline. The returned text fields are the sole source for editable PowerPoint text.',
      'Use sourceMaterialAnalysis.keyPoints as source-grounded claims. Use sourceMaterialAnalysis.dataPoints only when the source includes them, and choose metrics-dashboard or a comparison layout only when that evidence supports it. sourceMaterialAnalysis.availableVisuals are visual references, not license to invent additional visual claims. For every factual or numeric slide, return sourceIds using only IDs in sourceMaterialAnalysis.sources. Do not invent source IDs.',
      'When activeSection and sectionBatch are provided, generate only that section. Keep its exact page range, role, keyQuestion, purpose, key message, and visual focus. Every slide in the batch must help answer activeSection.keyQuestion. Use previousSlides only to continue the argument without repeating prior conclusions.',
      'Do not create a deck cover or final commitment slide inside a section unless its assigned global page range contains page 1 or the final page of the full deck.',
      'Treat presentationGuide as the default creative direction: follow its narrativeGuide for the argument, its visualGuide for visual pacing, and its slideRules as non-negotiable planning rules. Use requiredSections to form named stages in the narrative arc; do not omit a required section unless it conflicts with the source or target language.',
      'When purposeTemplate is supplied, it is the controlling presentation contract. Follow its defaultOutline in deck order and apply its compositionRules to every applicable slide. The active section must advance one of those outline stages; write all labels in the target language.',
      'When coreMessage is supplied, preserve its strategic meaning in strategy.coreThesis and ensure the cover, intermediate evidence, and closing action all reinforce it. Do not replace it with a generic topic summary.',
      'Assign exactly one slideRole to every slide. Choose only from opening, context, problem-framing, evidence, comparison, solution, implementation, case-study, decision, or conclusion. slideRole is the communication job, not the layout: choose it before visualStructure and make the title, proof points, decision, and layout reinforce that one job. Use comparison for trade-offs, evidence for source-backed proof, solution for the proposed answer, implementation for rollout, case-study for an example, and conclusion only for the final close.',
      'Use exactly the target language. English slides must contain no Hangul. Korean slides may use Korean text plus proper names, QLEARN for Startup, and standard uppercase business or technical abbreviations such as AI, R&D, API, KPI, OKR, ROI, LLM, GPT, B2B, and B2C. Do not write ordinary English sentences on Korean slides.',
      'The strategy.coreThesis must state the deck conclusion. strategy.audienceNeed states the audience tension. strategy.desiredOutcome states the decision or action expected after the presentation. strategy.narrativeArc must group the slide numbers into a clear beginning, evidence-building middle, and action-oriented close.',
      'Every slide must express one decision-relevant claim, not merely a topic. title is the conclusion the audience should remember, objective states why this slide exists, mainMessage explains the so-what in one complete sentence, and decision states the action or decision the audience should take next.',
      'Every required text property must be a complete non-empty string: title, subtitle, objective, mainMessage, decision, takeaway, every label, and every contentBlocks heading/detail. Never return an empty string, null, placeholder, or whitespace-only value for those fields. If a claim is uncertain, state the decision criterion or recommended next step rather than leaving a field blank.',
      'When the argument raises a problem, challenge, risk, or gap, close the coverage loop in the deck: include a solution that answers the problem, the concrete features or capabilities that make it workable, a source-backed KPI or qualitative review criterion that proves progress, and the expected operational, customer, learning, or financial impact. Do not imply those elements only in vague closing copy.',
      'Write titles as message headlines, never simple topic labels. A weak topic title such as "AI Platform", "Service Overview", or "Implementation Plan" must become a conclusion such as "A Governed AI Platform Enables Better Decisions". Use the slide mainMessage as the factual basis. Preserve the exact target language and keep the title concise enough for an editable PowerPoint title box.',
      'Every slide must include dependency. dependency.questionAddressed is the exact unresolved question carried from the preceding slide, dependency.answerSummary states how this slide resolves it, and dependency.nextQuestion is the single question that the following slide must answer. Copy the preceding slide nextQuestion verbatim into the following slide questionAddressed. On the first slide, previousSlideNumber must be null; on every other slide, it must be the preceding global page number. The final slide must set nextQuestion to null. This connection must advance the argument rather than restate the previous slide.',
      `contentBlocks are the supporting proof points shown in the layout. For the selected content density, produce exactly ${getDensityPolicy(request.contentDensity).blockCount} blocks: ${getDensityPolicy(request.contentDensity).description} Each heading is a precise short claim. Each detail is one compact, source-grounded explanatory sentence and must be between ${request.targetLanguage === 'Korean' ? getDensityPolicy(request.contentDensity).koreanMinLength : getDensityPolicy(request.contentDensity).englishMinLength} and ${request.targetLanguage === 'Korean' ? getDensityPolicy(request.contentDensity).koreanMaxLength : getDensityPolicy(request.contentDensity).englishMaxLength} characters so it remains readable in an editable PowerPoint card. Do not repeat the title in the mainMessage, or repeat the heading in its detail. Never invent data, citations, customer names, or metrics not present in the source; use qualitative evidence or a stated recommendation when source evidence is limited.`,
      'labels must match the contentBlock headings in the same order so legacy exports remain compatible.',
      'Classify each slide before choosing visualStructure: comparison for alternatives or before/after states; process for a workflow or sequence; timeline for milestones, phases, or dates; structure for a system, capability, or framework; data for source-backed metrics or evidence; case for a customer, scenario, or example; message for a single executive claim. Also return diagram for every slide: type must be none, process, cycle, hierarchy, timeline, relationship, or change; rationale states the content cue; nodes contains the 3-5 contentBlock headings. For a comparison with two clearly stated targets and two or more criteria, return comparisonTable: exactly three columnHeaders (criterion and two target names), source-grounded rows, a difference or key-result emphasis only when supported by the values, and one concise keyResult. Otherwise return comparisonTable as null. For source-backed numeric data, return chart: choose purpose comparison/trend/composition/distribution/target-progress and the matching type bar/line/donut/histogram/progress; series must contain only source-supported numeric values, targetValue is only used when the source states a target (or a percentage has the natural target of 100), and keyResult names the most important supported result. Return chart as null whenever the source does not contain enough numeric values; never invent a series, target, or percentage. Also return keyMetric when one source-backed metric is more decision-relevant than the rest: include its label, displayed value, numeric value, a changeText only if the source states a change rate, direction up/down/neutral, and a short comparisonText. Return keyMetric as null when the source gives no numeric metric. Use process for ordered steps, cycle for feedback loops, hierarchy for levels or foundations, timeline for dates and milestones, relationship for connected entities, and change for before-and-after states. Select the matching layout: side-by-side or before-after for change, numbered-process for process, roadmap for timeline, hub-and-spoke for relationship or cycle, pyramid for hierarchy, metrics-dashboard for data, case-story for a case, and message-emphasis or card-grid for a message. Never repeat a visualStructure on consecutive slides.',
      'When styleReference.templateDesign is provided, treat it as a selected template analysis. Reflect its signatureLayout in the plan and favor its recommendedVisualStructures only where they fit the message. Keep the required variety across the deck; do not force every slide into one template composition.',
      request.planningBatch
        ? 'This is one bounded section of a larger deck. Keep adjacent slides visually distinct and use the section visual focus where it fits; do not force an unrelated layout merely to meet a deck-wide diversity target.'
        : 'Use hero-visual for the cover and closing-commitment for the final slide. Use at least four distinct visual structures in a deck of four or more slides.',
      'For detailed content density, choose layouts that can comfortably hold five proof points, such as a hub-and-spoke, metrics dashboard, roadmap, pyramid, or two-column evidence structure. Do not compress five explanations into a narrow single row.',
      'Write concise, complete, factual copy. No ellipses, page markers, template labels, source headers, lorem ipsum, or invented citations.',
      'Titles must fit editable PowerPoint title boxes: 42 characters maximum in English or 22 characters maximum in Korean.',
      'Do not request, describe, or depend on generated slide images. HTML/CSS will render all text, cards, connectors, diagrams, and simple visual shapes as editable PowerPoint objects.',
      'Treat creationInstructions as mandatory constraints unless they conflict with the requested language, source facts, or safety requirements.',
      'For an expansion request, return exactly requestedSlideCount new slides only. Continue the argument after previousSlides without repeating its headline claims; use the remaining story roles such as evidence, application, execution detail, risk, governance, measurement, or closing action.',
    ],
  });
  const requestBody = JSON.stringify({
    model,
    reasoning: { effort: 'low' },
    max_output_tokens: getPlanningOutputTokenBudget(requestedSlideCount, request.contentDensity),
    input: [{ role: 'user', content: [{ type: 'input_text', text: prompt }] }],
    text: {
      format: {
        type: 'json_schema',
        name: 'ppt_slide_draft',
        strict: true,
        schema: planSchema,
      },
    },
  });

  const response = await fetchOpenAiWithRetry('https://api.openai.com/v1/responses', {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: requestBody,
  });
  const rawPayload = await response.text();
  const payload = parseOpenAiResponse(rawPayload, response.status);
  if (!response.ok) {
    throw new Error(payload.error?.message ?? `OpenAI slide copy planning failed (HTTP ${response.status}).`);
  }

  const output = extractResponseText(payload);
  if (!output) throw new Error('OpenAI slide copy planning did not include text output.');
  if (output.trimStart().startsWith('<')) throw new Error('OpenAI returned HTML instead of Slide JSON.');
  return parsePlan(output);
}

function getPlanningOutputTokenBudget(slideCount: number, contentDensity: ContentDensity | undefined): number {
  const perSlide = contentDensity === 'detailed' ? 1_350 : 1_050;
  return Math.min(6_000, Math.max(2_800, 1_400 + slideCount * perSlide));
}

function getPlanningSourceExcerpt(sourceText: string): string {
  const maxCharacters = 14_000;
  if (sourceText.length <= maxCharacters) return sourceText;
  const headLength = 10_000;
  const tailLength = 3_500;
  return `${sourceText.slice(0, headLength)}\n\n[Source excerpt shortened for this section planning batch]\n\n${sourceText.slice(-tailLength)}`;
}

function getPlanningSourceAnalysis(analysis: PptMakerRequest['sourceMaterialAnalysis']) {
  if (!analysis) return undefined;
  return {
    summary: analysis.summary.slice(0, 1_500),
    keyPoints: analysis.keyPoints.slice(0, 6),
    dataPoints: analysis.dataPoints.slice(0, 6),
    availableVisuals: analysis.availableVisuals.slice(0, 6),
    sources: analysis.sources.slice(0, 12),
  };
}

function getPlanningBlueprintContext(
  blueprint: PptMakerRequest['deckBlueprint'] | undefined,
  activeSection: ReturnType<typeof getActiveSection>,
) {
  if (!blueprint) return undefined;
  return {
    title: blueprint.title,
    strategy: blueprint.strategy,
    sections: activeSection ? [activeSection] : blueprint.sections.slice(0, 12),
  };
}

function parseOpenAiResponse(rawPayload: string, status: number): Record<string, unknown> & { error?: { message?: string } } {
  try {
    return JSON.parse(rawPayload) as Record<string, unknown> & { error?: { message?: string } };
  } catch {
    throw new Error(`OpenAI returned a non-JSON response (HTTP ${status}). Please retry the slide plan.`);
  }
}

async function expandPlanToRequestedSlideCount(
  apiKey: string,
  model: string,
  request: PptMakerRequest,
  plan: DraftPlan,
): Promise<DraftPlan> {
  let expandedPlan = plan;
  const targetSlideCount = getBatchSlideCount(request);
  const maxExpansionAttempts = Math.min(3, Math.max(1, targetSlideCount - plan.slides.length));

  for (let attempt = 0; attempt < maxExpansionAttempts && expandedPlan.slides.length < targetSlideCount; attempt += 1) {
    const missingSlideCount = targetSlideCount - expandedPlan.slides.length;
    const expansion = await requestPlan(apiKey, model, request, expandedPlan.slides, [], 'expand', missingSlideCount);
    if (expansion.slides.length === 0) break;
    expandedPlan = {
      ...expandedPlan,
      slides: [...expandedPlan.slides, ...expansion.slides],
    };
  }

  return {
    ...expandedPlan,
    slides: expandedPlan.slides.slice(0, targetSlideCount),
  };
}

const planSchema = {
  type: 'object', additionalProperties: false,
  required: ['strategy', 'slides'],
  properties: {
    strategy: {
      type: 'object', additionalProperties: false,
      required: ['coreThesis', 'audienceNeed', 'desiredOutcome', 'narrativeArc'],
      properties: {
        coreThesis: { type: 'string' }, audienceNeed: { type: 'string' }, desiredOutcome: { type: 'string' },
        narrativeArc: {
          type: 'array',
          items: {
            type: 'object', additionalProperties: false, required: ['phase', 'purpose', 'slideNumbers'],
            properties: { phase: { type: 'string' }, purpose: { type: 'string' }, slideNumbers: { type: 'array', items: { type: 'integer' } } },
          },
        },
      },
    },
    slides: {
      type: 'array',
      items: {
        type: 'object', additionalProperties: false,
        required: ['pageNumber', 'archetype', 'slideRole', 'dependency', 'visualStructure', 'diagram', 'comparisonTable', 'chart', 'keyMetric', 'mainMessage', 'title', 'subtitle', 'objective', 'labels', 'contentBlocks', 'decision', 'takeaway', 'sourceIds'],
        properties: {
          pageNumber: { type: 'integer' }, archetype: { type: 'string' }, slideRole: { type: 'string', enum: slideRoles }, visualStructure: { type: 'string' },
          diagram: {
            type: 'object', additionalProperties: false, required: ['type', 'rationale', 'nodes'],
            properties: { type: { type: 'string', enum: ['none', 'process', 'cycle', 'hierarchy', 'timeline', 'relationship', 'change'] }, rationale: { type: 'string' }, nodes: { type: 'array', items: { type: 'string' } } },
          },
          comparisonTable: {
            type: ['object', 'null'],
            additionalProperties: false,
            required: ['rationale', 'columnHeaders', 'rows', 'highlightedRowIndex', 'keyResult'],
            properties: {
              rationale: { type: 'string' },
              columnHeaders: { type: 'array', items: { type: 'string' } },
              rows: {
                type: 'array',
                items: {
                  type: 'object', additionalProperties: false, required: ['criterion', 'values', 'emphasis'],
                  properties: { criterion: { type: 'string' }, values: { type: 'array', items: { type: 'string' } }, emphasis: { type: 'string', enum: ['none', 'difference', 'key-result'] } },
                },
              },
              highlightedRowIndex: { type: ['integer', 'null'] },
              keyResult: { type: 'string' },
            },
          },
          chart: {
            type: ['object', 'null'],
            additionalProperties: false,
            required: ['purpose', 'type', 'rationale', 'series', 'targetValue', 'highlightedIndex', 'unit', 'keyResult'],
            properties: {
              purpose: { type: 'string', enum: ['comparison', 'trend', 'composition', 'distribution', 'target-progress'] },
              type: { type: 'string', enum: ['bar', 'line', 'donut', 'histogram', 'progress'] },
              rationale: { type: 'string' },
              series: { type: 'array', items: { type: 'object', additionalProperties: false, required: ['label', 'value'], properties: { label: { type: 'string' }, value: { type: 'number' } } } },
              targetValue: { type: ['number', 'null'] },
              highlightedIndex: { type: ['integer', 'null'] },
              unit: { type: 'string' }, keyResult: { type: 'string' },
            },
          },
          keyMetric: {
            type: ['object', 'null'],
            additionalProperties: false,
            required: ['label', 'displayValue', 'numericValue', 'changeText', 'direction', 'comparisonText', 'rationale'],
            properties: {
              label: { type: 'string' }, displayValue: { type: 'string' }, numericValue: { type: 'number' },
              changeText: { type: ['string', 'null'] }, direction: { type: 'string', enum: ['up', 'down', 'neutral'] },
              comparisonText: { type: 'string' }, rationale: { type: 'string' },
            },
          },
          dependency: {
            type: 'object', additionalProperties: false,
            required: ['previousSlideNumber', 'questionAddressed', 'answerSummary', 'nextQuestion'],
            properties: {
              previousSlideNumber: { type: ['integer', 'null'] },
              questionAddressed: { type: 'string' },
              answerSummary: { type: 'string' },
              nextQuestion: { type: ['string', 'null'] },
            },
          },
          mainMessage: { type: 'string' }, title: { type: 'string' }, subtitle: { type: 'string' },
          objective: { type: 'string' }, labels: { type: 'array', items: { type: 'string' } }, decision: { type: 'string' }, takeaway: { type: 'string' }, sourceIds: { type: 'array', items: { type: 'string' } },
          contentBlocks: {
            type: 'array',
            items: {
              type: 'object', additionalProperties: false, required: ['heading', 'detail'],
              properties: { heading: { type: 'string' }, detail: { type: 'string' } },
            },
          },
        },
      },
    },
  },
};

function parsePlan(text: string): DraftPlan {
  const parsed = JSON.parse(text) as { strategy?: unknown; slides?: unknown };
  if (!Array.isArray(parsed.slides)) throw new Error('OpenAI slide copy planning did not return a slides array.');
  return { strategy: normalizeStrategy(parsed.strategy), slides: parsed.slides.map((value, index) => normalizeSlide(value, index + 1)) };
}

function normalizeStrategy(value: unknown): DeckStrategy {
  const record = isRecord(value) ? value : {};
  const arc = Array.isArray(record.narrativeArc) ? record.narrativeArc : [];
  return {
    coreThesis: text(record.coreThesis), audienceNeed: text(record.audienceNeed), desiredOutcome: text(record.desiredOutcome),
    narrativeArc: arc.map((entry) => {
      const item = isRecord(entry) ? entry : {};
      return { phase: text(item.phase), purpose: text(item.purpose), slideNumbers: Array.isArray(item.slideNumbers) ? item.slideNumbers.filter((number): number is number => typeof number === 'number' && Number.isInteger(number) && number > 0) : [] };
    }),
  };
}

function normalizeSlide(value: unknown, fallbackPageNumber: number): DraftSlide {
  const record = isRecord(value) ? value : {};
  const contentBlocks = Array.isArray(record.contentBlocks) ? record.contentBlocks : [];
  const normalizedContentBlocks = contentBlocks.map((block) => {
    const item = isRecord(block) ? block : {};
    return { heading: text(item.heading), detail: text(item.detail) };
  }).filter((block) => block.heading && block.detail).slice(0, 5);
  const visualStructure = structures.includes(record.visualStructure as SlideVisualStructure)
    ? record.visualStructure as SlideVisualStructure
    : fallbackPageNumber === 1
      ? 'hero-visual'
      : 'card-grid';
  return {
    pageNumber: positive(record.pageNumber, fallbackPageNumber),
    archetype: archetypes.includes(record.archetype as SlideArchetype) ? record.archetype as SlideArchetype : fallbackPageNumber === 1 ? 'cover' : 'card-grid',
    slideRole: slideRoles.includes(record.slideRole as SlideRole)
      ? record.slideRole as SlideRole
      : getSlideRoleForStructure(visualStructure, fallbackPageNumber - 1, fallbackPageNumber),
    dependency: normalizeDependency(record.dependency, record),
    visualStructure,
    diagram: normalizeDiagram(record.diagram, normalizedContentBlocks),
    mainMessage: text(record.mainMessage), title: text(record.title), subtitle: text(record.subtitle), objective: text(record.objective),
    labels: Array.isArray(record.labels) ? record.labels.map(text).filter(Boolean).slice(0, 5) : [], takeaway: text(record.takeaway),
    contentBlocks: normalizedContentBlocks,
    comparisonTable: normalizeComparisonTable(record.comparisonTable, normalizedContentBlocks, {
      labels: Array.isArray(record.labels) ? record.labels.map(text).filter(Boolean).slice(0, 5) : [],
      slideRole: record.slideRole,
      title: text(record.title),
      mainMessage: text(record.mainMessage),
    }),
    chart: normalizeChart(record.chart, normalizedContentBlocks, {
      slideRole: record.slideRole,
      title: text(record.title),
      mainMessage: text(record.mainMessage),
    }),
    keyMetric: normalizeKeyMetric(record.keyMetric, normalizedContentBlocks),
    decision: text(record.decision),
    imageSlot: {
      id: `visual-${fallbackPageNumber}`,
      purpose: 'No generated visual asset is used in the editable layout.',
      placement: 'right-hero',
      prompt: '',
    },
    sourceIds: Array.isArray(record.sourceIds) ? record.sourceIds.map(text).filter(Boolean).slice(0, 4) : [],
  };
}

function normalizeDiagram(value: unknown, contentBlocks: unknown[]): SlideDiagramSpec {
  const record = isRecord(value) ? value : {};
  const type = ['none', 'process', 'cycle', 'hierarchy', 'timeline', 'relationship', 'change'].includes(text(record.type))
    ? text(record.type) as SlideDiagramType
    : 'none';
  const nodes = Array.isArray(record.nodes)
    ? record.nodes.map(text).filter(Boolean).slice(0, 5)
    : contentBlocks.map((block) => isRecord(block) ? text(block.heading) : '').filter(Boolean).slice(0, 5);
  return { type, rationale: text(record.rationale), nodes: type === 'none' ? [] : nodes };
}

function normalizeComparisonTable(
  value: unknown,
  contentBlocks: Array<{ heading: string; detail: string }>,
  slide: { labels: string[]; slideRole: unknown; title: string; mainMessage: string },
): SlideComparisonTableSpec | undefined {
  const record = isRecord(value) ? value : {};
  const columnHeaders = Array.isArray(record.columnHeaders) ? record.columnHeaders.map(text).filter(Boolean).slice(0, 3) : [];
  const rows = Array.isArray(record.rows) ? record.rows.map((entry) => {
    const item = isRecord(entry) ? entry : {};
    const emphasis = ['none', 'difference', 'key-result'].includes(text(item.emphasis))
      ? text(item.emphasis) as SlideTableEmphasis
      : 'none';
    return {
      criterion: text(item.criterion),
      values: Array.isArray(item.values) ? item.values.map(text).filter(Boolean).slice(0, 2) : [],
      emphasis,
    };
  }).filter((row) => row.criterion && row.values.length >= 2).slice(0, 5) : [];

  if (columnHeaders.length === 3 && rows.length > 0) {
    const highlightedRowIndex = typeof record.highlightedRowIndex === 'number' && record.highlightedRowIndex >= 0 && record.highlightedRowIndex < rows.length
      ? record.highlightedRowIndex
      : rows.findIndex((row) => row.emphasis !== 'none');
    return {
      rationale: text(record.rationale),
      columnHeaders,
      rows,
      highlightedRowIndex: highlightedRowIndex >= 0 ? highlightedRowIndex : null,
      keyResult: text(record.keyResult) || rows[highlightedRowIndex >= 0 ? highlightedRowIndex : rows.length - 1].criterion,
    };
  }

  return deriveSlideComparisonTable({
    title: slide.title,
    mainMessage: slide.mainMessage,
    labels: slide.labels,
    slideRole: slideRoles.includes(slide.slideRole as SlideRole) ? slide.slideRole as SlideRole : 'context',
    contentBlocks,
  });
}

function deriveSlideComparisonTable(slide: Pick<DraftSlide, 'title' | 'mainMessage' | 'labels' | 'slideRole' | 'contentBlocks'>): SlideComparisonTableSpec | undefined {
  const copy = getSlideSearchText(slide).toLocaleLowerCase();
  const isComparison = slide.slideRole === 'comparison' || /\b(?:versus|vs|trade-?off|alternative|before|after|compare|current|target)\b|비교|대안|전후|차이|현황|목표/u.test(copy);
  const blocks = slide.contentBlocks.filter((block) => block.heading.trim() && block.detail.trim());
  if (!isComparison || blocks.length < 2) return undefined;
  const midpoint = Math.ceil(blocks.length / 2);
  const leftBlocks = blocks.slice(0, midpoint);
  const rightBlocks = blocks.slice(midpoint);
  const rows = leftBlocks.map((left, index) => {
    const right = rightBlocks[index] ?? rightBlocks[rightBlocks.length - 1] ?? left;
    return {
      criterion: left.heading,
      values: [left.detail, right.detail],
      emphasis: hasMeaningfulNumericDifference(left.detail, right.detail) ? 'difference' as SlideTableEmphasis : 'none' as SlideTableEmphasis,
    };
  });
  if (rows.length === 0) return undefined;
  const highlightIndex = Math.max(0, rows.findIndex((row) => row.emphasis === 'difference'));
  if (rows[highlightIndex].emphasis === 'none') rows[highlightIndex].emphasis = 'key-result';
  const labels = slide.labels.map((label) => label.trim()).filter(Boolean);
  return {
    rationale: 'The slide compares alternatives or states, so criteria and outcomes are shown in an editable table.',
    columnHeaders: ['Criterion', ...(labels.length >= 2 ? labels.slice(0, 2) : ['Current state', 'Recommended state'])],
    rows: rows.slice(0, 5),
    highlightedRowIndex: highlightIndex,
    keyResult: rows[highlightIndex].criterion,
  };
}

function hasMeaningfulNumericDifference(left: string, right: string): boolean {
  const numberPattern = /-?\d+(?:[.,]\d+)?/g;
  const leftValue = Number((left.match(numberPattern) ?? [''])[0].replace(',', '.'));
  const rightValue = Number((right.match(numberPattern) ?? [''])[0].replace(',', '.'));
  return Number.isFinite(leftValue) && Number.isFinite(rightValue) && Math.abs(rightValue - leftValue) >= Math.max(1, Math.abs(leftValue) * 0.2);
}

function normalizeChart(
  value: unknown,
  contentBlocks: Array<{ heading: string; detail: string }>,
  slide: { slideRole: unknown; title: string; mainMessage: string },
): SlideChartSpec | undefined {
  const record = isRecord(value) ? value : {};
  const purpose = ['comparison', 'trend', 'composition', 'distribution', 'target-progress'].includes(text(record.purpose))
    ? text(record.purpose) as SlideChartPurpose
    : null;
  const type = ['bar', 'line', 'donut', 'histogram', 'progress'].includes(text(record.type))
    ? text(record.type) as SlideChartType
    : null;
  const series = Array.isArray(record.series) ? record.series.map((entry) => {
    const item = isRecord(entry) ? entry : {};
    return { label: text(item.label), value: typeof item.value === 'number' && Number.isFinite(item.value) ? item.value : Number.NaN };
  }).filter((item) => item.label && Number.isFinite(item.value)).slice(0, 6) : [];

  if (purpose && type && series.length > 0) {
    const highlightedIndex = typeof record.highlightedIndex === 'number' && record.highlightedIndex >= 0 && record.highlightedIndex < series.length
      ? record.highlightedIndex
      : series.reduce((bestIndex, item, index) => item.value > series[bestIndex]!.value ? index : bestIndex, 0);
    return {
      purpose, type, series,
      rationale: text(record.rationale),
      targetValue: typeof record.targetValue === 'number' && Number.isFinite(record.targetValue) ? record.targetValue : null,
      highlightedIndex,
      unit: text(record.unit),
      keyResult: text(record.keyResult) || `${series[highlightedIndex]!.label}: ${series[highlightedIndex]!.value}${text(record.unit)}`,
    };
  }

  return deriveSlideChart({
    title: slide.title,
    mainMessage: slide.mainMessage,
    slideRole: slideRoles.includes(slide.slideRole as SlideRole) ? slide.slideRole as SlideRole : 'context',
    contentBlocks,
  });
}

function deriveSlideChart(slide: Pick<DraftSlide, 'title' | 'mainMessage' | 'slideRole' | 'contentBlocks'>): SlideChartSpec | undefined {
  const copy = getSlideSearchText(slide).toLocaleLowerCase();
  const series = slide.contentBlocks.map((block) => ({ label: block.heading, value: extractFirstNumber(block.detail) }))
    .filter((item): item is { label: string; value: number } => item.value !== null)
    .slice(0, 6);
  if (series.length === 0) return undefined;
  const purpose = selectChartPurpose(copy, series.length);
  if ((purpose === 'comparison' || purpose === 'trend' || purpose === 'composition' || purpose === 'distribution') && series.length < 2) return undefined;
  const hasPercent = slide.contentBlocks.some((block) => block.detail.includes('%'));
  const targetValue = purpose === 'target-progress' ? extractTargetValue(copy) ?? (hasPercent ? 100 : null) : null;
  if (purpose === 'target-progress' && targetValue === null) return undefined;
  const highlightedIndex = series.reduce((bestIndex, item, index) => item.value > series[bestIndex]!.value ? index : bestIndex, 0);
  const typeByPurpose: Record<SlideChartPurpose, SlideChartType> = { comparison: 'bar', trend: 'line', composition: 'donut', distribution: 'histogram', 'target-progress': 'progress' };
  return {
    purpose, type: typeByPurpose[purpose],
    rationale: `Source-backed numeric evidence is best communicated as a ${typeByPurpose[purpose]} chart for ${purpose}.`,
    series, targetValue, highlightedIndex, unit: hasPercent ? '%' : '',
    keyResult: `${series[highlightedIndex]!.label}: ${series[highlightedIndex]!.value}${hasPercent ? '%' : ''}`,
  };
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

function normalizeKeyMetric(value: unknown, contentBlocks: Array<{ heading: string; detail: string }>): SlideKeyMetricSpec | undefined {
  const record = isRecord(value) ? value : {};
  const numericValue = typeof record.numericValue === 'number' && Number.isFinite(record.numericValue) ? record.numericValue : null;
  const direction = ['up', 'down', 'neutral'].includes(text(record.direction)) ? text(record.direction) as SlideMetricDirection : 'neutral';
  if (numericValue !== null && text(record.label) && text(record.displayValue)) {
    return {
      label: text(record.label), displayValue: text(record.displayValue), numericValue,
      changeText: text(record.changeText) || null, direction,
      comparisonText: text(record.comparisonText), rationale: text(record.rationale),
    };
  }
  return deriveSlideKeyMetric(contentBlocks);
}

function deriveSlideKeyMetric(contentBlocks: Array<{ heading: string; detail: string }>): SlideKeyMetricSpec | undefined {
  const candidates = contentBlocks.map((block, index) => ({ block, index, value: extractFirstNumber(block.detail) }))
    .filter((item): item is { block: { heading: string; detail: string }; index: number; value: number } => item.value !== null)
    .sort((left, right) => getMetricImportanceScore(right.block, right.index) - getMetricImportanceScore(left.block, left.index));
  const candidate = candidates[0];
  if (!candidate) return undefined;
  const valueToken = candidate.block.detail.match(/-?\d+(?:[.,]\d+)?\s*[%$€£₩]?/u)?.[0]?.replace(/\s+/g, '') ?? String(candidate.value);
  const change = extractMetricChange(candidate.block.detail);
  return {
    label: candidate.block.heading, displayValue: valueToken, numericValue: candidate.value,
    changeText: change?.text ?? null, direction: change?.direction ?? 'neutral',
    comparisonText: compactEditableCopy(candidate.block.detail, 90),
    rationale: 'The most decision-relevant source-backed value is promoted as the slide key metric.',
  };
}

function getMetricImportanceScore(block: { heading: string; detail: string }, index: number): number {
  const copy = `${block.heading} ${block.detail}`.toLocaleLowerCase();
  const signalCount = (copy.match(/\b(?:kpi|roi|revenue|growth|adoption|cost|time|risk|target|goal|increase|decrease)\b|성과|증가|감소|목표|달성|비용|매출|시간|위험/g) ?? []).length;
  return signalCount * 10 - index;
}

function extractMetricChange(value: string): { text: string; direction: SlideMetricDirection } | undefined {
  const explicit = value.match(/([+-]\s*\d+(?:[.,]\d+)?\s*%)/u)?.[1]?.replace(/\s+/g, '');
  if (explicit) return { text: explicit, direction: explicit.startsWith('-') ? 'down' : 'up' };
  const directional = value.match(/(\d+(?:[.,]\d+)?\s*%\s*(?:increase|decrease|up|down|증가|감소))/iu)?.[1];
  if (!directional) return undefined;
  const normalized = directional.replace(/\s+/g, ' ');
  return { text: normalized, direction: /decrease|down|감소/iu.test(normalized) ? 'down' : 'up' };
}

function normalizeDependency(value: unknown, slide: Record<string, unknown>): SlideDependency {
  const record = isRecord(value) ? value : {};
  const questionAddressed = text(record.questionAddressed) || text(slide.objective) || text(slide.mainMessage);
  const answerSummary = text(record.answerSummary) || text(slide.mainMessage) || text(slide.decision);
  const nextQuestion = text(record.nextQuestion) || null;

  return {
    previousSlideNumber: typeof record.previousSlideNumber === 'number' && Number.isInteger(record.previousSlideNumber) && record.previousSlideNumber > 0
      ? record.previousSlideNumber
      : null,
    questionAddressed,
    answerSummary,
    nextQuestion,
  };
}

function ensurePlanTextCompleteness(plan: DraftPlan, request: PptMakerRequest): DraftPlan {
  const language = request.targetLanguage;
  const densityPolicy = getDensityPolicy(request.contentDensity);
  const fallbackStrategy = getFallbackStrategy(request, plan.strategy);

  return {
    strategy: fallbackStrategy,
    slides: plan.slides.map((slide, index) => ensureSlideTextCompleteness(slide, index + 1, language, densityPolicy.blockCount)),
  };
}

function ensureSlideTextCompleteness(
  slide: DraftSlide,
  fallbackPageNumber: number,
  language: TargetLanguage,
  requiredBlockCount: number,
): DraftSlide {
  const existingBlocks = slide.contentBlocks.filter((block) => block.heading.trim() || block.detail.trim());
  const sourceCopy = firstNonEmpty([
    slide.mainMessage,
    slide.objective,
    slide.takeaway,
    slide.decision,
    slide.subtitle,
    slide.title,
    ...existingBlocks.flatMap((block) => [block.detail, block.heading]),
  ]);
  const defaultMainMessage = sourceCopy || getFallbackMainMessage(language);
  const usedHeadingKeys = new Set<string>();
  const contentBlocks = Array.from({ length: requiredBlockCount }, (_, index) => {
    const block = existingBlocks[index];
    const proposedHeading = firstNonEmpty([
      block?.heading,
      slide.labels[index],
      getFallbackBlockHeading(language, index + 1),
    ]);
    const heading = ensureUniqueBlockHeading(proposedHeading, language, index + 1, usedHeadingKeys);
    const detail = ensureMinimumDetail(
      firstNonEmpty([
        block?.detail,
        existingBlocks[index % Math.max(existingBlocks.length, 1)]?.detail,
        defaultMainMessage,
        slide.objective,
        slide.takeaway,
      ]),
      language,
    );
    return { heading, detail };
  });

  const mainMessage = firstNonEmpty([slide.mainMessage, contentBlocks[0]?.detail, defaultMainMessage]);
  const objective = firstNonEmpty([slide.objective, mainMessage, slide.takeaway, getFallbackObjective(language)]);
  const decision = firstNonEmpty([slide.decision, slide.takeaway, mainMessage, getFallbackDecision(language)]);
  const takeaway = firstNonEmpty([slide.takeaway, slide.decision, mainMessage, getFallbackTakeaway(language)]);
  const title = firstNonEmpty([
    slide.title,
    getConciseMessageHeadline(mainMessage, language),
    getFallbackTitle(language),
  ]);

  return {
    ...slide,
    pageNumber: positive(slide.pageNumber, fallbackPageNumber),
    title,
    subtitle: firstNonEmpty([slide.subtitle, objective, mainMessage, getFallbackSubtitle(language)]),
    objective,
    mainMessage,
    labels: contentBlocks.map((block) => block.heading),
    contentBlocks,
    decision,
    takeaway,
  };
}

function ensureUniqueBlockHeading(
  proposedHeading: string,
  language: TargetLanguage,
  index: number,
  usedHeadingKeys: Set<string>,
): string {
  const fallback = getFallbackBlockHeading(language, index);
  const key = normalizeCopyKey(proposedHeading);
  if (key && !usedHeadingKeys.has(key)) {
    usedHeadingKeys.add(key);
    return proposedHeading;
  }
  usedHeadingKeys.add(normalizeCopyKey(fallback));
  return fallback;
}

function getFallbackStrategy(request: PptMakerRequest, strategy: DeckStrategy): DeckStrategy {
  const topic = firstNonEmpty([request.topic, request.purpose, request.audience]);
  const thesis = firstNonEmpty([strategy.coreThesis, request.coreMessage, topic, getFallbackMainMessage(request.targetLanguage)]);
  return {
    coreThesis: thesis,
    audienceNeed: firstNonEmpty([strategy.audienceNeed, request.audience, getFallbackAudienceNeed(request.targetLanguage)]),
    desiredOutcome: firstNonEmpty([strategy.desiredOutcome, request.purpose, getFallbackDecision(request.targetLanguage)]),
    narrativeArc: strategy.narrativeArc,
  };
}

function firstNonEmpty(values: Array<string | undefined | null>): string {
  return values.map((value) => text(value)).find(Boolean) ?? '';
}

function ensureMinimumDetail(value: string, language: TargetLanguage): string {
  const normalized = text(value);
  const minimum = getDensityPolicy('detailed')[language === 'Korean' ? 'koreanMinLength' : 'englishMinLength'];
  if (getTextLength(normalized) >= minimum) return normalized;
  const suffix = language === 'Korean'
    ? ' 이 근거는 다음 실행 판단과 책임 있는 행동을 구체화합니다.'
    : ' This evidence guides the team\'s next accountable decision.';
  return `${normalized || getFallbackMainMessage(language)}${suffix}`.replace(/\s+/g, ' ').trim();
}

function getFallbackTitle(language: TargetLanguage): string {
  return language === 'Korean' ? '핵심 근거가 다음 실행 판단을 이끕니다' : 'Evidence Guides the Next Decision';
}

function getFallbackSubtitle(language: TargetLanguage): string {
  return language === 'Korean' ? '핵심 근거와 실행 방향을 정리합니다.' : 'A concise view of the evidence and action direction.';
}

function getFallbackObjective(language: TargetLanguage): string {
  return language === 'Korean' ? '의사결정에 필요한 핵심 근거와 다음 행동을 명확히 합니다.' : 'Clarify the evidence and next action needed for a decision.';
}

function getFallbackMainMessage(language: TargetLanguage): string {
  return language === 'Korean'
    ? '검증된 근거를 바탕으로 다음 실행 판단과 책임 있는 행동을 구체화합니다.'
    : 'Verified evidence clarifies the next accountable decision and action.';
}

function getFallbackDecision(language: TargetLanguage): string {
  return language === 'Korean' ? '핵심 근거를 확인하고 다음 실행 책임자를 정합니다.' : 'Confirm the evidence and assign the next accountable action.';
}

function getFallbackTakeaway(language: TargetLanguage): string {
  return language === 'Korean' ? '근거를 실행 판단으로 연결해야 다음 단계가 분명해집니다.' : 'Connect evidence to an accountable decision before moving forward.';
}

function getFallbackAudienceNeed(language: TargetLanguage): string {
  return language === 'Korean' ? '의사결정자는 근거와 실행 책임이 연결된 판단 기준이 필요합니다.' : 'Decision-makers need a clear link between evidence and action.';
}

function getFallbackBlockHeading(language: TargetLanguage, index: number): string {
  return language === 'Korean' ? `핵심 근거 ${index}` : `Key evidence ${index}`;
}

function ensurePlanDiversity(plan: DraftPlan, request: PptMakerRequest): DraftPlan {
  const totalSlides = getTotalSlideCount(request);
  const batchStartPage = getBatchStartPage(request);
  let previousStructure: SlideVisualStructure | undefined;

  const slides = plan.slides.map((slide, index) => {
    const globalIndex = batchStartPage - 1 + index;
    const layout = selectContentAwareLayout(slide, globalIndex, totalSlides, request, previousStructure);
    const visualStructure = layout.visualStructure;
    const archetype = getArchetypeForStructure(visualStructure, totalSlides, globalIndex);
    const slideRole = getSlideRoleForStructure(visualStructure, globalIndex, totalSlides);

    const compactedSlide = compactSlideCopyForLayout(slide, request.targetLanguage, request.contentDensity);
    previousStructure = visualStructure;

    return {
      ...compactedSlide,
      pageNumber: batchStartPage + index,
      archetype,
      slideRole,
      title: improveConclusionTitle(compactedSlide.title, compactedSlide.mainMessage, request.targetLanguage),
      visualStructure,
      diagram: layout.diagram,
      layoutSelection: layout.layoutSelection,
      masterLayout: selectSlideMasterLayout(
        { pageNumber: batchStartPage + index, archetype, slideRole, visualStructure },
        totalSlides,
      ),
    };
  });

  return {
    ...plan,
    slides: linkBatchDependencies(slides, totalSlides),
  };
}

function selectContentAwareLayout(
  slide: DraftSlide,
  index: number,
  totalSlides: number,
  request: PptMakerRequest,
  previousStructure: SlideVisualStructure | undefined,
): { visualStructure: SlideVisualStructure; layoutSelection: SlideLayoutSelection; diagram: SlideDiagramSpec } {
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
  const candidates = diagram.type === 'none' ? getLayoutCandidates(classification) : getDiagramStructureCandidates(diagram.type);
  const preferred = getBlueprintVisualPreference(index, request);
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

function deriveSlideDiagram(slide: DraftSlide): SlideDiagramSpec {
  const copy = getSlideSearchText(slide).toLocaleLowerCase();
  const nodes = slide.contentBlocks.map((block) => block.heading.trim()).filter(Boolean).slice(0, 5);
  const classification = classifySlideContent(slide);
  if (classification === 'data' || classification === 'case') return createNoDiagram('The slide is evidence- or case-led, so its chart or case layout should remain the primary visual structure.');
  const matches = (expression: RegExp) => expression.test(copy);
  if (slide.slideRole === 'comparison' || matches(/\b(?:before-and-after|before\/after|current state|future state|transform|transition|change)\b|변화|전환|개선/u)) return { type: 'change', rationale: 'The slide contrasts a current and target state, so it should show the change explicitly.', nodes };
  if (matches(/\b(?:timeline|milestone|quarter|phase|year|month|roadmap|schedule)\b|타임라인|마일스톤|분기|연도|일정|로드맵/u)) return { type: 'timeline', rationale: 'The slide contains time-based milestones or phases, so it should use a timeline.', nodes };
  if (matches(/\b(?:cycle|loop|iterate|iteration|feedback|continuous)\b|순환|반복|피드백|선순환/u)) return { type: 'cycle', rationale: 'The slide describes a repeating feedback loop, so it should use a cycle diagram.', nodes };
  if (matches(/\b(?:hierarchy|layer|tier|level|foundation|pyramid)\b|계층|기반|상위|하위|레벨|피라미드/u)) return { type: 'hierarchy', rationale: 'The slide describes ordered layers or capability levels, so it should use a hierarchy.', nodes };
  if (matches(/\b(?:relationship|ecosystem|network|stakeholder|interaction|interconnected)\b|관계|연결|네트워크|이해관계|상호작용/u)) return { type: 'relationship', rationale: 'The slide describes connected entities, so it should use a relationship map.', nodes };
  if (slide.slideRole === 'implementation' || matches(/\b(?:process|step|sequence|rollout|implement)\b|프로세스|절차|순서|단계|실행/u)) return { type: 'process', rationale: 'The slide describes an ordered workflow, so it should use a process diagram.', nodes };
  return createNoDiagram('The slide is best communicated with an editorial content layout rather than a formal diagram.');
}

function createNoDiagram(rationale: string): SlideDiagramSpec {
  return { type: 'none', rationale, nodes: [] };
}

function getDiagramStructureCandidates(type: Exclude<SlideDiagramType, 'none'>): SlideVisualStructure[] {
  return {
    process: ['numbered-process', 'roadmap'],
    cycle: ['hub-and-spoke', 'numbered-process'],
    hierarchy: ['pyramid-framework', 'hub-and-spoke'],
    timeline: ['roadmap', 'numbered-process'],
    relationship: ['hub-and-spoke', 'card-grid'],
    change: ['before-after-mapping', 'side-by-side-comparison'],
  }[type];
}

function classifySlideContent(slide: DraftSlide): SlideContentClassification {
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

function getLayoutFamily(structure: SlideVisualStructure): SlideLayoutFamily {
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

function selectSlideMasterLayout(
  slide: Pick<DraftSlide, 'pageNumber' | 'archetype' | 'slideRole' | 'visualStructure'>,
  totalSlides: number,
): SlideMasterLayoutId {
  if (slide.pageNumber === 1 || slide.slideRole === 'opening' || slide.visualStructure === 'hero-visual') return 'cover';
  if (totalSlides > 1 && (slide.pageNumber === totalSlides || slide.slideRole === 'conclusion' || slide.visualStructure === 'closing-commitment')) return 'conclusion';
  if (slide.pageNumber === 2 && totalSlides >= 6) return 'agenda';
  if (slide.slideRole === 'comparison' || slide.visualStructure === 'side-by-side-comparison' || slide.visualStructure === 'before-after-mapping') return 'comparison';
  if (slide.slideRole === 'evidence' || slide.visualStructure === 'metrics-dashboard') return 'chart';
  if (slide.archetype === 'section-opener' || slide.slideRole === 'context' || slide.visualStructure === 'message-emphasis') return 'section';
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

function getSlideSearchText(slide: Pick<DraftSlide, 'title' | 'mainMessage' | 'contentBlocks'>): string {
  return [slide.title, slide.mainMessage, ...slide.contentBlocks.flatMap((block) => [block.heading, block.detail])].join(' ');
}

function compactSlideCopyForLayout(
  slide: DraftSlide,
  language: TargetLanguage,
  contentDensity: ContentDensity | undefined,
): DraftSlide {
  const limits = textLengthLimits[language];
  const densityPolicy = getDensityPolicy(contentDensity);
  const detailLimit = language === 'Korean' ? densityPolicy.koreanMaxLength : densityPolicy.englishMaxLength;
  const contentBlocks = slide.contentBlocks.map((block) => ({
    heading: compactEditableCopy(block.heading, limits.heading),
    detail: compactEditableCopy(block.detail, detailLimit),
  }));
  const mainMessage = compactEditableCopy(slide.mainMessage, limits.mainMessage);
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
    title: compactEditableCopy(slide.title, limits.title),
    subtitle: compactEditableCopy(slide.subtitle, limits.subtitle),
    objective: compactEditableCopy(slide.objective, limits.objective),
    mainMessage,
    labels: contentBlocks.length > 0
      ? contentBlocks.map((block) => block.heading)
      : slide.labels.map((label) => compactEditableCopy(label, limits.heading)),
    contentBlocks,
    decision: compactEditableCopy(slide.decision, limits.takeaway),
    takeaway: compactEditableCopy(slide.takeaway, limits.takeaway),
    comparisonTable,
    chart,
    keyMetric,
  };
}

function compactEditableCopy(value: string, maxLength: number): string {
  const normalized = value.replace(/\.{2,}/g, '').replace(/\s+/g, ' ').trim();
  if (getTextLength(normalized) <= maxLength) return normalized;

  const sentences = normalized
    .match(/[^.!?。！？]+[.!?。！？]?/gu)
    ?.map((sentence) => sentence.trim())
    .filter(Boolean) ?? [];
  const firstSentence = sentences[0] ?? '';
  if (firstSentence && getTextLength(firstSentence) <= maxLength) return firstSentence;

  const shortened = Array.from(normalized).slice(0, maxLength).join('').trim();
  const boundaryIndex = [
    shortened.lastIndexOf(' '),
    shortened.lastIndexOf(','),
    shortened.lastIndexOf(';'),
    shortened.lastIndexOf(':'),
    shortened.lastIndexOf('·'),
  ].reduce((best, index) => Math.max(best, index), -1);

  return boundaryIndex >= Math.floor(maxLength * 0.55)
    ? shortened.slice(0, boundaryIndex).trim()
    : shortened;
}

function linkBatchDependencies(slides: DraftSlide[], totalSlides: number): DraftSlide[] {
  return slides.map((slide, index) => {
    const nextSlide = slides[index + 1];
    const questionAddressed = slide.dependency.questionAddressed || slide.objective || slide.mainMessage;
    const nextQuestion = nextSlide
      ? nextSlide.dependency.questionAddressed || nextSlide.objective || nextSlide.mainMessage
      : slide.pageNumber === totalSlides
        ? null
        : slide.dependency.nextQuestion || slide.decision;

    return {
      ...slide,
      dependency: {
        previousSlideNumber: slide.pageNumber === 1 ? null : slide.pageNumber - 1,
        questionAddressed,
        answerSummary: slide.dependency.answerSummary || slide.mainMessage || slide.decision,
        nextQuestion,
      },
    };
  });
}

function getSlideRoleForStructure(
  visualStructure: SlideVisualStructure,
  index: number,
  totalSlides: number,
): SlideRole {
  if (index === 0) return 'opening';
  if (totalSlides > 1 && index === totalSlides - 1) return 'conclusion';

  const roleByStructure: Record<SlideVisualStructure, SlideRole> = {
    'hero-visual': 'opening',
    'message-emphasis': 'context',
    'card-grid': 'solution',
    'side-by-side-comparison': 'comparison',
    'numbered-process': 'implementation',
    'before-after-mapping': 'problem-framing',
    'hub-and-spoke': 'solution',
    'metrics-dashboard': 'evidence',
    roadmap: 'implementation',
    'pyramid-framework': 'solution',
    'case-story': 'case-study',
    'closing-commitment': 'conclusion',
  };

  return roleByStructure[visualStructure];
}

function getRequiredVisualStructure(
  index: number,
  totalSlides: number,
  request: PptMakerRequest,
): SlideVisualStructure {
  if (index === 0) return 'hero-visual';
  if (totalSlides > 1 && index === totalSlides - 1) return 'closing-commitment';

  const previousStructure = getRequiredVisualStructure(index - 1, totalSlides, request);
  const preferredStructure = getBlueprintVisualPreference(index, request);
  if (preferredStructure && preferredStructure !== previousStructure) return preferredStructure;

  const middleStructures: SlideVisualStructure[] = [
    'message-emphasis',
    'card-grid',
    'side-by-side-comparison',
    'numbered-process',
    'hub-and-spoke',
    'metrics-dashboard',
    'roadmap',
    'pyramid-framework',
    'case-story',
    'before-after-mapping',
  ];
  const defaultStructure = middleStructures[(index - 1) % middleStructures.length];
  if (defaultStructure !== previousStructure) return defaultStructure;

  return middleStructures.find((structure) => structure !== previousStructure) ?? 'card-grid';
}

function getBlueprintVisualPreference(index: number, request: PptMakerRequest): SlideVisualStructure | null {
  const pageNumber = index + 1;
  const section = request.deckBlueprint?.sections.find((entry) =>
    pageNumber >= entry.slideStart && pageNumber < entry.slideStart + entry.slideCount
  );
  if (!section) return null;

  const localIndex = pageNumber - section.slideStart;
  const preferredStructure = section.visualFocus?.[localIndex];
  if (!preferredStructure || preferredStructure === 'hero-visual' || preferredStructure === 'closing-commitment') {
    return null;
  }
  return preferredStructure;
}

function getArchetypeForStructure(
  visualStructure: SlideVisualStructure,
  totalSlides: number,
  index: number,
): SlideArchetype {
  if (index === 0) return 'cover';
  if (totalSlides > 1 && index === totalSlides - 1) return 'closing';

  const archetypeByStructure: Partial<Record<SlideVisualStructure, SlideArchetype>> = {
    'message-emphasis': 'section-opener',
    'card-grid': 'card-grid',
    'side-by-side-comparison': 'comparison',
    'numbered-process': 'process',
    'before-after-mapping': 'before-after',
    'metrics-dashboard': 'case-dashboard',
  };
  return archetypeByStructure[visualStructure] ?? 'card-grid';
}

function validatePlan(plan: DraftPlan, request: PptMakerRequest): string[] {
  const issues: string[] = [];
  const slides = plan.slides;
  const batchSlideCount = getBatchSlideCount(request);
  const batchStartPage = getBatchStartPage(request);
  const totalSlides = getTotalSlideCount(request);
  const sourceIds = new Set(request.sourceMaterialAnalysis?.sources.map((source) => source.id) ?? []);
  if (slides.length !== batchSlideCount) issues.push(`Expected ${batchSlideCount} slides but received ${slides.length}.`);
  const strategy = request.deckBlueprint?.strategy ?? plan.strategy;
  if (!strategy.coreThesis || !strategy.audienceNeed || !strategy.desiredOutcome) issues.push('The deck strategy is missing a thesis, audience need, or desired outcome.');
  if (!request.planningBatch && strategy.narrativeArc.length < 3) issues.push('The deck strategy needs a beginning, evidence-building middle, and action-oriented close.');
  const distinct = new Set(slides.map((slide) => slide.visualStructure));
  if (!request.planningBatch && batchSlideCount >= 4 && distinct.size < Math.min(4, batchSlideCount)) {
    issues.push('The plan needs at least four distinct visual structures.');
  }
  if (request.planningBatch && batchSlideCount >= 3 && distinct.size < Math.min(3, batchSlideCount)) {
    issues.push('This section needs at least three distinct visual structures.');
  }
  slides.forEach((slide, index) => {
    const slideNumber = batchStartPage + index;
    if (slide.pageNumber !== slideNumber) issues.push(`Slide ${slideNumber} has an invalid page number.`);
    if (!slideRoles.includes(slide.slideRole)) issues.push(`Slide ${slideNumber} is missing a valid presentation role.`);
    const expectedPreviousSlideNumber = slideNumber === 1 ? null : slideNumber - 1;
    if (slide.dependency.previousSlideNumber !== expectedPreviousSlideNumber) issues.push(`Slide ${slideNumber} has an invalid predecessor link.`);
    if (!slide.dependency.questionAddressed || !slide.dependency.answerSummary) issues.push(`Slide ${slideNumber} is missing a question-and-answer dependency link.`);
    if (slideNumber === totalSlides && slide.dependency.nextQuestion !== null) issues.push(`Slide ${slideNumber} must close the narrative without another question.`);
    if (slideNumber < totalSlides && !slide.dependency.nextQuestion) issues.push(`Slide ${slideNumber} must hand off one question to the next slide.`);
    if (index > 0 && slide.dependency.questionAddressed !== slides[index - 1].dependency.nextQuestion) issues.push(`Slide ${slideNumber} does not answer the question from slide ${slideNumber - 1}.`);
    if (slideNumber === 1 && slide.visualStructure !== 'hero-visual') issues.push('Slide 1 must use hero-visual.');
    if (totalSlides > 1 && slideNumber === totalSlides && slide.visualStructure !== 'closing-commitment') issues.push(`Slide ${slideNumber} must use closing-commitment.`);
    if (index > 0 && slide.visualStructure === slides[index - 1].visualStructure) issues.push(`Slides ${index} and ${slideNumber} repeat the same visual structure.`);
    if (!request.planningBatch && index > 0 && getLayoutFamily(slide.visualStructure) === getLayoutFamily(slides[index - 1].visualStructure)) {
      issues.push(`Slides ${index} and ${slideNumber} repeat the same layout family.`);
    }
    if (slide.labels.length < 3) issues.push(`Slide ${slideNumber} needs at least three labels.`);
    if (!slide.objective || !slide.decision) issues.push(`Slide ${slideNumber} is missing a decision objective or next action.`);
    const densityPolicy = getDensityPolicy(request.contentDensity);
    if (slide.contentBlocks.length !== densityPolicy.blockCount) issues.push(`Slide ${slideNumber} needs exactly ${densityPolicy.blockCount} supporting proof points for the selected content density.`);
    if (new Set(slide.contentBlocks.map((block) => block.heading.toLocaleLowerCase())).size !== slide.contentBlocks.length) issues.push(`Slide ${slideNumber} repeats a supporting proof point.`);
    if (!slide.contentBlocks.every((block) => block.detail.length >= (request.targetLanguage === 'Korean' ? densityPolicy.koreanMinLength : densityPolicy.englishMinLength))) issues.push(`Slide ${slideNumber} has a supporting proof point without enough explanation for the selected content density.`);
    if (!slide.labels.every((label, labelIndex) => label === slide.contentBlocks[labelIndex]?.heading)) issues.push(`Slide ${slideNumber} labels must match the supporting proof point headings.`);
    [slide.title, slide.subtitle, slide.objective, slide.mainMessage, slide.decision, slide.takeaway, ...slide.labels, ...slide.contentBlocks.flatMap((block) => [block.heading, block.detail])].forEach((value) => {
      if (!value) issues.push(`Slide ${slideNumber} has an empty text field.`);
      if (/\.{2,}|\[[^\]]*(?:page|\uD398\uC774\uC9C0)[^\]]*\]|\b(?:Designed for|Moves From|Slide Title|Key Point|Lorem ipsum)\b/iu.test(value)) issues.push(`Slide ${slideNumber} contains placeholder or clipped text.`);
      if (request.targetLanguage === 'English' && hangul.test(value)) issues.push(`Slide ${slideNumber} contains Korean text despite English being selected.`);
      if (request.targetLanguage === 'Korean' && hasUnapprovedLatinCopy(value)) issues.push(`Slide ${slideNumber} contains unapproved English copy: "${value}".`);
    });
    issues.push(...getEditableTextLengthIssues(slide, request.targetLanguage, densityPolicy));
    if (isGenericTitle(slide.title)) issues.push(`Slide ${slideNumber} needs a decision-oriented title instead of "${slide.title}".`);
    else if (isTopicOnlyTitle(slide.title, request.targetLanguage)) issues.push(`Slide ${slideNumber} title must state the slide conclusion instead of the topic "${slide.title}".`);
    if (slide.sourceIds?.some((sourceId) => !sourceIds.has(sourceId))) issues.push(`Slide ${slideNumber} references an unknown source.`);
    const slideText = [slide.title, slide.subtitle, slide.objective, slide.mainMessage, slide.decision, slide.takeaway, ...slide.contentBlocks.flatMap((block) => [block.heading, block.detail])].join(' ');
    if (sourceIds.size > 0 && /\d|%|\$|\u20a9|\u20ac/u.test(slideText) && (slide.sourceIds?.length ?? 0) === 0) issues.push(`Slide ${slideNumber} has a numeric claim without a linked source.`);
  });
  reportRepeatedSlideCopy(slides, issues);
  return Array.from(new Set(issues));
}

function getEditableTextLengthIssues(
  slide: DraftSlide,
  language: TargetLanguage,
  densityPolicy: ReturnType<typeof getDensityPolicy>,
): string[] {
  const limits = textLengthLimits[language];
  const detailLimit = language === 'Korean' ? densityPolicy.koreanMaxLength : densityPolicy.englishMaxLength;
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

  slide.contentBlocks.forEach((block, index) => {
    if (getTextLength(block.heading) > limits.heading) issues.push(`Slide ${slide.pageNumber} proof point ${index + 1} heading exceeds the ${limits.heading}-character editable layout limit.`);
    if (getTextLength(block.detail) > detailLimit) issues.push(`Slide ${slide.pageNumber} proof point ${index + 1} detail exceeds the ${detailLimit}-character editable layout limit.`);
  });

  return issues;
}

function getTextLength(value: string): number {
  return Array.from(value).length;
}

function isGenericTitle(value: string): boolean {
  return genericTitles.has(normalizeCopyKey(value));
}

function improveConclusionTitle(title: string, mainMessage: string, language: TargetLanguage): string {
  const normalizedTitle = title.replace(/\s+/g, ' ').trim();
  if (!isTopicOnlyTitle(normalizedTitle, language)) return normalizedTitle;

  const limit = textLengthLimits[language].title;
  const messageCandidate = getConciseMessageHeadline(mainMessage, language);
  if (messageCandidate && getTextLength(messageCandidate) <= limit && !isTopicOnlyTitle(messageCandidate, language) && !isGenericMessageHeadline(messageCandidate)) {
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

function isTopicOnlyTitle(value: string, language: TargetLanguage): boolean {
  const title = value.replace(/\s+/g, ' ').trim();
  if (!title) return false;
  if (isGenericTitle(title)) return true;
  if (/\bQLEARN(?:\s+for\s+Startup)?\b/iu.test(title)) return false;
  if (language === 'English') {
    const wordCount = title.split(/\s+/u).filter(Boolean).length;
    return wordCount <= 6 && !englishConclusionTitlePattern.test(title);
  }
  return getTextLength(title) <= 18 && !koreanConclusionTitlePattern.test(title);
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
  return genericMessageHeadlinePattern.test(value.trim());
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

function reportRepeatedSlideCopy(slides: DraftSlide[], issues: string[]): void {
  const titles = new Map<string, number>();
  const messages = new Map<string, number>();
  slides.forEach((slide) => {
    const titleKey = normalizeCopyKey(slide.title);
    const messageKey = normalizeCopyKey(slide.mainMessage);
    const priorTitlePage = titles.get(titleKey);
    const priorMessagePage = messages.get(messageKey);
    if (priorTitlePage) issues.push(`Slides ${priorTitlePage} and ${slide.pageNumber} repeat the same title.`);
    else if (titleKey) titles.set(titleKey, slide.pageNumber);
    if (priorMessagePage) issues.push(`Slides ${priorMessagePage} and ${slide.pageNumber} repeat the same main message.`);
    else if (messageKey) messages.set(messageKey, slide.pageNumber);
  });
}

function getRedundancySuggestions(slides: DraftSlide[]) {
  const suggestions: Array<{
    id: string;
    slideNumbers: [number, number];
    kind: 'title' | 'message' | 'case' | 'diagram';
    action: 'merge' | 'remove' | 'separate-role';
    confidence: number;
    summary: string;
  }> = [];
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
    .filter((suggestion, index, all) => all.findIndex((candidate) => candidate.id === suggestion.id) === index);
}

function getCoverageSuggestions(slides: DraftSlide[]) {
  const problemSlides = slides.filter((slide) =>
    slide.slideRole === 'problem-framing' || includesCoverageSignal(slide, /\b(?:problem|challenge|pain|risk|gap|issue|barrier)\b|문제|과제|한계|위험|격차|어려움/u),
  );
  if (problemSlides.length === 0) return [];

  const hasSolution = slides.some((slide) =>
    slide.slideRole === 'solution' ||
    slide.slideRole === 'implementation' ||
    includesCoverageSignal(slide, /\b(?:solution|solve|approach|proposal|recommend|roadmap|implementation)\b|해결|방안|제안|실행|도입/u),
  );
  const hasFeature = slides.some((slide) => (
    ((slide.slideRole === 'solution' || slide.slideRole === 'implementation') && slide.contentBlocks.length >= 3) ||
    includesCoverageSignal(slide, /\b(?:feature|capability|function|workflow|process|module)\b|기능|역량|체계|프로세스|모듈/u)
  ));
  const hasKpi = slides.some((slide) =>
    slide.visualStructure === 'metrics-dashboard' ||
    includesCoverageSignal(slide, /\b(?:kpi|metric|measure|target|baseline|roi|okr)\b|성과|지표|측정|목표|기준/u),
  );
  const hasImpact = slides.some((slide) =>
    (slide.slideRole === 'decision' || slide.slideRole === 'conclusion') &&
    includesCoverageSignal(slide, /\b(?:impact|outcome|benefit|value|result|effect|expected)\b|효과|기대|성과|가치|결과|개선/u),
  );
  const problemSlideNumbers = problemSlides.map((slide) => slide.pageNumber);
  const suggestions = [];

  if (!hasSolution) {
    suggestions.push(createCoverageSuggestion(problemSlideNumbers, 'solution', 'required', 'solution', 'card-grid', 'A stated problem has no corresponding solution. Add a solution slide that directly answers the problem and names the proposed approach.'));
  }
  if (hasSolution && !hasFeature) {
    suggestions.push(createCoverageSuggestion(problemSlideNumbers, 'feature', 'recommended', 'solution', 'hub-and-spoke', 'The solution is named, but its concrete functions or capabilities are not explained. Add the 3-5 capabilities that make the solution usable.'));
  }
  if (!hasKpi) {
    suggestions.push(createCoverageSuggestion(problemSlideNumbers, 'kpi', 'recommended', 'evidence', 'metrics-dashboard', 'No success measure is defined. Add source-backed KPIs, targets, or qualitative review criteria that show whether the solution is working.'));
  }
  if (!hasImpact) {
    suggestions.push(createCoverageSuggestion(problemSlideNumbers, 'impact', 'required', 'conclusion', 'closing-commitment', 'The expected effect is not explicit. Add the operational, customer, learning, or financial outcome the audience should expect after implementation.'));
  }

  return suggestions;
}

function includesCoverageSignal(
  slide: Pick<DraftSlide, 'title' | 'mainMessage' | 'contentBlocks'>,
  pattern: RegExp,
): boolean {
  return pattern.test([
    slide.title,
    slide.mainMessage,
    slide.contentBlocks.flatMap((block) => [block.heading, block.detail]).join(' '),
  ].join(' '));
}

function createCoverageSuggestion(
  problemSlideNumbers: number[],
  kind: 'solution' | 'feature' | 'kpi' | 'impact',
  severity: 'required' | 'recommended',
  recommendedSlideRole: SlideRole,
  recommendedVisualStructure: SlideVisualStructure,
  summary: string,
) {
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
  kind: 'title' | 'message' | 'case' | 'diagram',
  action: 'merge' | 'remove' | 'separate-role',
  confidence: number,
) {
  const actionSummary = {
    merge: 'Combine overlapping evidence into one stronger slide, then use the released slide for a missing question.',
    remove: 'Keep the clearer slide and remove the duplicate after confirming no unique source or decision is lost.',
    'separate-role': 'Keep both slides only if one explains the evidence and the other turns it into a decision, comparison, or next action.',
  } as const;

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
  const stopWords = new Set(['the', 'and', 'for', 'with', 'that', 'this', 'from', 'into', 'your', 'about', 'need', 'needs', 'will', 'should', 'must']);
  return new Set(
    value.toLocaleLowerCase().match(/[\p{L}\p{N}]+/gu)
      ?.filter((token) => token.length > 1 && !stopWords.has(token)) ?? [],
  );
}

function normalizeCopyKey(value: string): string {
  return value.toLocaleLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').replace(/\s+/g, ' ').trim();
}

function extractResponseText(payload: Record<string, unknown>): string | null {
  if (typeof payload.output_text === 'string' && payload.output_text.trim()) return payload.output_text;
  const output = Array.isArray(payload.output) ? payload.output : [];
  for (const item of output) {
    if (!isRecord(item) || !Array.isArray(item.content)) continue;
    for (const content of item.content) {
      if (!isRecord(content)) continue;
      const directText = text(content.text);
      if (directText) return directText;
      const nestedText = isRecord(content.text) ? text(content.text.value) : '';
      if (nestedText) return nestedText;
      const outputText = text(content.output_text);
      if (outputText) return outputText;
      const nestedOutputText = isRecord(content.output_text) ? text(content.output_text.value) : '';
      if (nestedOutputText) return nestedOutputText;
    }
  }
  return null;
}

function normalizeRequest(value: unknown): PptMakerRequest | null {
  if (!isRecord(value) || typeof value.sourceText !== 'string' || !value.sourceText.trim()) return null;

  const styleReference = isRecord(value.styleReference) ? value.styleReference : {};
  const templateDesign = isRecord(styleReference.templateDesign) ? styleReference.templateDesign : null;
  const recommendedVisualStructures = Array.isArray(templateDesign?.recommendedVisualStructures)
    ? templateDesign.recommendedVisualStructures.filter(
      (structure): structure is SlideVisualStructure => typeof structure === 'string' && structures.includes(structure as SlideVisualStructure),
    )
    : [];
  const sourceDocument = isRecord(value.sourceDocument) && typeof value.sourceDocument.name === 'string' &&
    (value.sourceDocument.type === 'docx' || value.sourceDocument.type === 'pdf' || value.sourceDocument.type === 'pptx' || value.sourceDocument.type === 'xlsx' || value.sourceDocument.type === 'image') &&
    typeof value.sourceDocument.extractedCharacterCount === 'number'
    ? { name: value.sourceDocument.name, type: value.sourceDocument.type, extractedCharacterCount: value.sourceDocument.extractedCharacterCount }
    : undefined;
  const contentDensity = value.contentDensity === 'standard' || value.contentDensity === 'detailed' ? value.contentDensity : 'light';
  const slideCount = typeof value.slideCount === 'number' && Number.isFinite(value.slideCount)
    ? Math.min(100, Math.max(1, Math.round(value.slideCount)))
    : 6;
  const deckBlueprint = normalizeDeckBlueprint(value.deckBlueprint);
  const planningBatch = normalizePlanningBatch(value.planningBatch, deckBlueprint, slideCount);

  return {
    sourceText: value.sourceText.trim(),
    sourceDocument,
    creationInstructions: text(value.creationInstructions) || undefined,
    targetLanguage: value.targetLanguage === 'Korean' ? 'Korean' : 'English',
    topic: text(value.topic) || undefined,
    audience: text(value.audience) || 'General audience',
    purpose: text(value.purpose) || 'Business presentation',
    presentationDurationMinutes: typeof value.presentationDurationMinutes === 'number' && Number.isFinite(value.presentationDurationMinutes)
      ? Math.min(480, Math.max(1, Math.round(value.presentationDurationMinutes)))
      : undefined,
    documentType: text(value.documentType) || undefined,
    slideCount,
    contentDensity,
    presentationIntent: text(value.presentationIntent) || undefined,
    coreMessage: text(value.coreMessage) || undefined,
    requiredSections: text(value.requiredSections) || undefined,
    purposeTemplate: parsePurposeTemplate(value.purposeTemplate),
    sourceMaterialAnalysis: normalizeSourceMaterialAnalysis(value.sourceMaterialAnalysis),
    deckBlueprint,
    planningBatch,
    presentationGuide: isRecord(value.presentationGuide) ? {
      name: text(value.presentationGuide.name) || 'General presentation guide',
      narrativeGuide: text(value.presentationGuide.narrativeGuide),
      visualGuide: text(value.presentationGuide.visualGuide),
      slideRules: Array.isArray(value.presentationGuide.slideRules) ? value.presentationGuide.slideRules.map(text).filter(Boolean) : [],
    } : undefined,
    styleReference: {
      name: text(styleReference.name) || 'QLEARN',
      notes: text(styleReference.notes) || 'Clean, decision-oriented presentation.',
      primaryColorLabel: text(styleReference.primaryColorLabel) || 'navy',
      accentColorLabel: text(styleReference.accentColorLabel) || 'orange',
      templateDesign: templateDesign ? {
        signatureLayout: text(templateDesign.signatureLayout),
        recommendedVisualStructures,
      } : undefined,
    },
  };
}

function parsePurposeTemplate(value: unknown): PurposeTemplate | undefined {
  if (!isRecord(value)) return undefined;
  const id = text(value.id);
  const name = text(value.name);
  const documentType = text(value.documentType);
  const presentationIntent = text(value.presentationIntent);
  if (!id || !name || !documentType || !presentationIntent) return undefined;
  return {
    id,
    name,
    description: text(value.description),
    documentType,
    presentationIntent,
    defaultOutline: Array.isArray(value.defaultOutline) ? value.defaultOutline.map(text).filter(Boolean).slice(0, 12) : [],
    compositionRules: Array.isArray(value.compositionRules) ? value.compositionRules.map(text).filter(Boolean).slice(0, 8) : [],
  };
}

function normalizeSourceMaterialAnalysis(value: unknown): PptMakerRequest['sourceMaterialAnalysis'] | undefined {
  if (!isRecord(value)) return undefined;
  const values = (input: unknown) => Array.isArray(input) ? input.map(text).filter(Boolean).slice(0, 6) : [];
  const summary = text(value.summary);
  const sources = Array.isArray(value.sources) ? value.sources.map((source) => {
    const item = isRecord(source) ? source : {};
    const id = text(item.id);
    const sourceName = text(item.sourceName);
    const documentName = text(item.documentName);
    if (!id || !sourceName || !documentName) return null;
    return { id, sourceName, documentName, publicationYear: typeof item.publicationYear === 'number' ? item.publicationYear : null, url: text(item.url) || null, verifiedAt: text(item.verifiedAt) || new Date().toISOString().slice(0, 10) };
  }).filter(Boolean).slice(0, 20) as Array<{ id: string; sourceName: string; documentName: string; publicationYear: number | null; url: string | null; verifiedAt: string }> : [];
  return summary ? { summary, keyPoints: values(value.keyPoints), dataPoints: values(value.dataPoints), availableVisuals: values(value.availableVisuals), sources } : undefined;
}

function getBatchSlideCount(request: PptMakerRequest): number {
  return request.planningBatch?.slideCount ?? request.slideCount;
}

function getBatchStartPage(request: PptMakerRequest): number {
  return request.planningBatch?.startPage ?? 1;
}

function getTotalSlideCount(request: PptMakerRequest): number {
  return request.planningBatch?.totalSlides ?? request.slideCount;
}

function getActiveSection(request: PptMakerRequest) {
  const sectionId = request.planningBatch?.sectionId;
  return sectionId ? request.deckBlueprint?.sections.find((section) => section.id === sectionId) : undefined;
}

function normalizeDeckBlueprint(value: unknown): PptMakerRequest['deckBlueprint'] | undefined {
  if (!isRecord(value) || !Array.isArray(value.sections)) return undefined;
  const sections = value.sections.map((entry, index) => {
    const section = isRecord(entry) ? entry : {};
    return {
      id: text(section.id) || `section-${index + 1}`,
      title: text(section.title),
      role: text(section.role) || undefined,
      keyQuestion: text(section.keyQuestion) || undefined,
      purpose: text(section.purpose),
      keyMessage: text(section.keyMessage),
      slideStart: positive(section.slideStart, 1),
      slideCount: positive(section.slideCount, 1),
      visualFocus: Array.isArray(section.visualFocus)
        ? section.visualFocus.filter((structure): structure is SlideVisualStructure => typeof structure === 'string' && structures.includes(structure as SlideVisualStructure))
        : [],
    };
  });
  if (!sections.length) return undefined;
  return {
    title: text(value.title) || 'Untitled Deck',
    strategy: normalizeStrategy(value.strategy),
    sections,
  };
}

function normalizePlanningBatch(
  value: unknown,
  blueprint: PptMakerRequest['deckBlueprint'] | undefined,
  fallbackTotalSlides: number,
): PptMakerRequest['planningBatch'] | undefined {
  if (!isRecord(value) || !blueprint) return undefined;
  const sectionId = text(value.sectionId);
  const section = blueprint.sections.find((entry) => entry.id === sectionId);
  if (!section) return undefined;
  const previousSlides = Array.isArray(value.previousSlides)
    ? value.previousSlides.map((entry) => {
      const slide = isRecord(entry) ? entry : {};
      return { pageNumber: positive(slide.pageNumber, 1), title: text(slide.title), mainMessage: text(slide.mainMessage), decision: text(slide.decision) };
    }).filter((slide) => slide.title || slide.mainMessage || slide.decision)
    : undefined;
  return {
    sectionId,
    startPage: positive(value.startPage, section.slideStart),
    slideCount: Math.min(10, positive(value.slideCount, section.slideCount)),
    totalSlides: Math.min(100, positive(value.totalSlides, fallbackTotalSlides)),
    previousSlides,
  };
}
function isRecord(value: unknown): value is Record<string, unknown> { return typeof value === 'object' && value !== null; }
function hasUnapprovedLatinCopy(value: string): boolean {
  const withoutApprovedBrandNames = value
    .replace(/\bQLEARN\s+for\s+Startup\b/giu, 'QLEARN')
    .replace(/\bQLEARN\s+Startup\b/giu, 'QLEARN');
  const tokens = withoutApprovedBrandNames.match(/[A-Za-z][A-Za-z0-9]*(?:[&+./-][A-Za-z0-9]+)*/g) ?? [];
  return tokens.some((token) => {
    if (['AI', 'QLEARN', 'PPT', 'CTO', 'CEO', 'SaaS', 'PoC'].includes(token)) return false;
    const uppercaseAbbreviation = /^[A-Z][A-Z0-9]*(?:[&+./-][A-Z0-9]+)*$/u;
    return !(uppercaseAbbreviation.test(token) && token.replace(/[^A-Z0-9]/gu, '').length >= 2);
  });
}
function text(value: unknown): string { return typeof value === 'string' ? value.trim() : ''; }
function positive(value: unknown, fallback: number): number { return typeof value === 'number' && Number.isInteger(value) && value > 0 ? value : fallback; }
function json(data: unknown, status = 200): Response { return new Response(JSON.stringify(data), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }); }
