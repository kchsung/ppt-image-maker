type TargetLanguage = 'English' | 'Korean';
type ContentDensity = 'light' | 'standard' | 'detailed';
type SlideArchetype = 'cover' | 'section-opener' | 'card-grid' | 'comparison' | 'process' | 'before-after' | 'case-dashboard' | 'closing';
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
type SlideImagePlacement = 'right-hero' | 'left-hero' | 'center-visual' | 'card-visual' | 'hub-visual' | 'full-bleed-visual';

type PptMakerRequest = {
  sourceText: string;
  sourceDocument?: { name: string; type: 'docx' | 'pdf' | 'pptx'; extractedCharacterCount: number };
  creationInstructions?: string;
  targetLanguage: TargetLanguage;
  audience: string;
  purpose: string;
  slideCount: number;
  contentDensity?: ContentDensity;
  presentationIntent?: string;
  coreMessage?: string;
  requiredSections?: string;
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
  visualStructure: SlideVisualStructure;
  mainMessage: string;
  title: string;
  subtitle: string;
  objective: string;
  labels: string[];
  contentBlocks: Array<{ heading: string; detail: string }>;
  decision: string;
  takeaway: string;
  imageSlot: { id: string; purpose: string; placement: SlideImagePlacement; prompt: string };
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
const structures: SlideVisualStructure[] = [
  'hero-visual', 'message-emphasis', 'card-grid', 'side-by-side-comparison', 'numbered-process', 'before-after-mapping',
  'hub-and-spoke', 'metrics-dashboard', 'roadmap', 'pyramid-framework', 'case-story', 'closing-commitment',
];
const placements: SlideImagePlacement[] = ['right-hero', 'left-hero', 'center-visual', 'card-visual', 'hub-visual', 'full-bleed-visual'];
const hangul = /[\u3131-\u318e\uac00-\ud7a3]/u;
const densityPolicies = {
  light: { blockCount: 3, koreanMinLength: 8, englishMinLength: 12, description: '3 concise proof points with one short explanatory sentence each.' },
  standard: { blockCount: 4, koreanMinLength: 14, englishMinLength: 20, description: '4 proof points with enough context to explain the claim, evidence, and implication.' },
  detailed: { blockCount: 5, koreanMinLength: 22, englishMinLength: 32, description: '5 substantial proof points that preserve material context, evidence, implications, and an actionable recommendation.' },
} as const satisfies Record<ContentDensity, { blockCount: number; koreanMinLength: number; englishMinLength: number; description: string }>;
const genericTitles = new Set(['overview', 'introduction', 'summary', 'conclusion', '\uac1c\uc694', '\uc18c\uac1c', '\uc694\uc57d', '\uacb0\ub860']);

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

    const model = Deno.env.get('OPENAI_PPT_PLAN_MODEL') ?? 'gpt-4o';
    let plan = await expandPlanToRequestedSlideCount(apiKey, model, request, await requestPlan(apiKey, model, request));
    plan = ensurePlanDiversity(plan, request);
    let issues = validatePlan(plan, request);
    if (issues.length > 0) {
      plan = await expandPlanToRequestedSlideCount(
        apiKey,
        model,
        request,
        await requestPlan(apiKey, model, request, plan.slides, issues, 'repair'),
      );
      plan = ensurePlanDiversity(plan, request);
      issues = validatePlan(plan, request);
    }
    if (issues.length > 0) return json({ error: `Slide copy QA failed: ${issues[0]}`, issues }, 422);

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
        ],
        issues: [],
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
    deckBlueprint: request.deckBlueprint,
    contentDensity: request.contentDensity ?? 'light',
    targetLanguage: request.targetLanguage,
    audience: request.audience,
    purpose: request.purpose,
    presentationIntent: request.presentationIntent ?? 'strategy-decision',
    coreMessage: request.coreMessage ?? 'Derive a clear source-grounded core message.',
    requiredSections: request.requiredSections ?? 'No mandatory sections were provided.',
    presentationGuide: request.presentationGuide,
    sourceDocument: request.sourceDocument,
    creationInstructions: request.creationInstructions ?? 'No additional instructions were provided.',
    styleReference: request.styleReference,
    sourceText: request.sourceText,
    previousSlides: priorSlides,
    qaIssuesToFix: qaIssues,
    rules: [
      'First create a planning brief from the purpose, audience, coreMessage, requiredSections, presentationGuide, creationInstructions, and sourceText. Then form a persuasive, decision-oriented storyline. The returned text fields are the sole source for editable PowerPoint text.',
      'When activeSection and sectionBatch are provided, generate only that section. Keep its exact page range, purpose, key message, and visual focus. Use previousSlides only to continue the argument without repeating prior conclusions.',
      'Do not create a deck cover or final commitment slide inside a section unless its assigned global page range contains page 1 or the final page of the full deck.',
      'Treat presentationGuide as the default creative direction: follow its narrativeGuide for the argument, its visualGuide for visual pacing, and its slideRules as non-negotiable planning rules. Use requiredSections to form named stages in the narrative arc; do not omit a required section unless it conflicts with the source or target language.',
      'When coreMessage is supplied, preserve its strategic meaning in strategy.coreThesis and ensure the cover, intermediate evidence, and closing action all reinforce it. Do not replace it with a generic topic summary.',
      'Before selecting visualStructure, assign every slide a distinct communication job: establish context, diagnose a problem, explain a model, compare choices, show evidence, stage a rollout, or request a decision. Use that job to choose the layout, rather than applying a repeated visual pattern.',
      'Use exactly the target language. English slides must contain no Hangul. Korean slides may use Korean text plus proper names, QLEARN for Startup, and standard uppercase business or technical abbreviations such as AI, R&D, API, KPI, OKR, ROI, LLM, GPT, B2B, and B2C. Do not write ordinary English sentences on Korean slides.',
      'The strategy.coreThesis must state the deck conclusion. strategy.audienceNeed states the audience tension. strategy.desiredOutcome states the decision or action expected after the presentation. strategy.narrativeArc must group the slide numbers into a clear beginning, evidence-building middle, and action-oriented close.',
      'Every slide must express one decision-relevant claim, not merely a topic. title is the conclusion the audience should remember, objective states why this slide exists, mainMessage explains the so-what, and decision states the action or decision the audience should take next.',
      `contentBlocks are the supporting proof points shown in the layout. For the selected content density, produce exactly ${getDensityPolicy(request.contentDensity).blockCount} blocks: ${getDensityPolicy(request.contentDensity).description} Each heading is a precise short claim; each detail is source-grounded and must have at least ${request.targetLanguage === 'Korean' ? getDensityPolicy(request.contentDensity).koreanMinLength : getDensityPolicy(request.contentDensity).englishMinLength} characters. Never invent data, citations, customer names, or metrics not present in the source; use qualitative evidence or a stated recommendation when source evidence is limited.`,
      'labels must match the contentBlock headings in the same order so legacy exports remain compatible.',
      'Every slide needs a different information composition where the message calls for it. Never repeat a visualStructure on consecutive slides. Select the structure to fit the argument: comparison for trade-offs, process for a method, metrics-dashboard only for source-backed measures, roadmap for staged execution, and hub-and-spoke for a system model.',
      'When styleReference.templateDesign is provided, treat it as a selected template analysis. Reflect its signatureLayout in the plan and favor its recommendedVisualStructures only where they fit the message. Keep the required variety across the deck; do not force every slide into one template composition.',
      'Use hero-visual for the cover and closing-commitment for the final slide. Use at least four distinct visual structures in a deck of four or more slides.',
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
    max_output_tokens: 16384,
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

  let lastError: Error | null = null;
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      const response = await fetch('https://api.openai.com/v1/responses', {
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
    } catch (error) {
      lastError = error instanceof Error ? error : new Error('OpenAI slide copy planning failed.');
      if (attempt === 0 && isTransientOpenAiPlanError(lastError)) continue;
      throw lastError;
    }
  }

  throw lastError ?? new Error('OpenAI slide copy planning failed.');
}

function parseOpenAiResponse(rawPayload: string, status: number): Record<string, unknown> & { error?: { message?: string } } {
  try {
    return JSON.parse(rawPayload) as Record<string, unknown> & { error?: { message?: string } };
  } catch {
    throw new Error(`OpenAI returned a non-JSON response (HTTP ${status}). Please retry the slide plan.`);
  }
}

function isTransientOpenAiPlanError(error: Error): boolean {
  return /non-JSON response|returned HTML instead of Slide JSON|fetch failed|HTTP (?:408|429|500|502|503|504)/iu.test(error.message);
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
        required: ['pageNumber', 'archetype', 'visualStructure', 'mainMessage', 'title', 'subtitle', 'objective', 'labels', 'contentBlocks', 'decision', 'takeaway'],
        properties: {
          pageNumber: { type: 'integer' }, archetype: { type: 'string' }, visualStructure: { type: 'string' },
          mainMessage: { type: 'string' }, title: { type: 'string' }, subtitle: { type: 'string' },
          objective: { type: 'string' }, labels: { type: 'array', items: { type: 'string' } }, decision: { type: 'string' }, takeaway: { type: 'string' },
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
  return {
    pageNumber: positive(record.pageNumber, fallbackPageNumber),
    archetype: archetypes.includes(record.archetype as SlideArchetype) ? record.archetype as SlideArchetype : fallbackPageNumber === 1 ? 'cover' : 'card-grid',
    visualStructure: structures.includes(record.visualStructure as SlideVisualStructure) ? record.visualStructure as SlideVisualStructure : fallbackPageNumber === 1 ? 'hero-visual' : 'card-grid',
    mainMessage: text(record.mainMessage), title: text(record.title), subtitle: text(record.subtitle), objective: text(record.objective),
    labels: Array.isArray(record.labels) ? record.labels.map(text).filter(Boolean).slice(0, 5) : [], takeaway: text(record.takeaway),
    contentBlocks: contentBlocks.map((block) => {
      const item = isRecord(block) ? block : {};
      return { heading: text(item.heading), detail: text(item.detail) };
    }).filter((block) => block.heading && block.detail).slice(0, 5),
    decision: text(record.decision),
    imageSlot: {
      id: `visual-${fallbackPageNumber}`,
      purpose: 'No generated visual asset is used in the editable layout.',
      placement: 'right-hero',
      prompt: '',
    },
  };
}

function ensurePlanDiversity(plan: DraftPlan, request: PptMakerRequest): DraftPlan {
  const totalSlides = getTotalSlideCount(request);
  const batchStartPage = getBatchStartPage(request);

  return {
    ...plan,
    slides: plan.slides.map((slide, index) => {
      const globalIndex = batchStartPage - 1 + index;
      const visualStructure = getRequiredVisualStructure(globalIndex, totalSlides, request);
      const archetype = getArchetypeForStructure(visualStructure, totalSlides, globalIndex);

      return {
        ...slide,
        pageNumber: batchStartPage + index,
        archetype,
        visualStructure,
      };
    }),
  };
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
  const preferredStructure = section.visualFocus[localIndex];
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
  if (slides.length !== batchSlideCount) issues.push(`Expected ${batchSlideCount} slides but received ${slides.length}.`);
  const strategy = request.deckBlueprint?.strategy ?? plan.strategy;
  if (!strategy.coreThesis || !strategy.audienceNeed || !strategy.desiredOutcome) issues.push('The deck strategy is missing a thesis, audience need, or desired outcome.');
  if (!request.planningBatch && strategy.narrativeArc.length < 3) issues.push('The deck strategy needs a beginning, evidence-building middle, and action-oriented close.');
  const distinct = new Set(slides.map((slide) => slide.visualStructure));
  if (batchSlideCount >= 4 && distinct.size < Math.min(4, batchSlideCount)) issues.push('The plan needs at least four distinct visual structures.');
  slides.forEach((slide, index) => {
    const slideNumber = batchStartPage + index;
    if (slide.pageNumber !== slideNumber) issues.push(`Slide ${slideNumber} has an invalid page number.`);
    if (slideNumber === 1 && slide.visualStructure !== 'hero-visual') issues.push('Slide 1 must use hero-visual.');
    if (totalSlides > 1 && slideNumber === totalSlides && slide.visualStructure !== 'closing-commitment') issues.push(`Slide ${slideNumber} must use closing-commitment.`);
    if (index > 0 && slide.visualStructure === slides[index - 1].visualStructure) issues.push(`Slides ${index} and ${slideNumber} repeat the same visual structure.`);
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
    if (request.targetLanguage === 'English' && slide.title.length > 42) issues.push(`Slide ${slideNumber} title is too long for the editable layout.`);
    if (request.targetLanguage === 'Korean' && [...slide.title].length > 22) issues.push(`Slide ${slideNumber} title is too long for the editable layout.`);
    if (isGenericTitle(slide.title)) issues.push(`Slide ${slideNumber} needs a decision-oriented title instead of "${slide.title}".`);
  });
  reportRepeatedSlideCopy(slides, issues);
  return Array.from(new Set(issues));
}

function isGenericTitle(value: string): boolean {
  return genericTitles.has(normalizeCopyKey(value));
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

function normalizeCopyKey(value: string): string {
  return value.toLocaleLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').replace(/\s+/g, ' ').trim();
}

function extractResponseText(payload: Record<string, unknown>): string | null {
  if (typeof payload.output_text === 'string' && payload.output_text.trim()) return payload.output_text;
  const output = Array.isArray(payload.output) ? payload.output : [];
  for (const item of output) {
    if (!isRecord(item) || !Array.isArray(item.content)) continue;
    for (const content of item.content) {
      if (isRecord(content) && typeof content.text === 'string' && content.text.trim()) return content.text;
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
    (value.sourceDocument.type === 'docx' || value.sourceDocument.type === 'pdf' || value.sourceDocument.type === 'pptx') &&
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
    audience: text(value.audience) || 'General audience',
    purpose: text(value.purpose) || 'Business presentation',
    slideCount,
    contentDensity,
    presentationIntent: text(value.presentationIntent) || undefined,
    coreMessage: text(value.coreMessage) || undefined,
    requiredSections: text(value.requiredSections) || undefined,
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
