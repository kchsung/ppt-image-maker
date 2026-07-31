type TargetLanguage = 'English' | 'Korean';
import { DEFAULT_PPT_PLAN_MODEL, fetchOpenAiWithRetry } from '../_shared/openaiRetry.ts';
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

type PurposeTemplate = {
  id: string;
  name: string;
  description: string;
  documentType: string;
  presentationIntent: string;
  defaultOutline: string[];
  compositionRules: string[];
};

type PlannerRequest = {
  sourceText: string;
  targetLanguage: TargetLanguage;
  topic?: string;
  audience: string;
  purpose: string;
  presentationDurationMinutes?: number;
  documentType?: string;
  slideCount: number;
  contentDensity?: 'light' | 'standard' | 'detailed';
  presentationIntent?: string;
  coreMessage?: string;
  requiredSections?: string;
  purposeTemplate?: PurposeTemplate;
  sourceMaterialAnalysis?: { summary: string; keyPoints: string[]; dataPoints: string[]; availableVisuals: string[]; sources: unknown[] };
  creationInstructions?: string;
  presentationGuide?: { name: string; narrativeGuide: string; visualGuide: string; slideRules: string[] };
  styleReference?: { name: string; notes: string; primaryColorLabel: string; accentColorLabel: string };
};

type DeckStrategy = {
  coreThesis: string;
  audienceNeed: string;
  desiredOutcome: string;
  narrativeArc: Array<{ phase: string; purpose: string; slideNumbers: number[] }>;
};

type DeckSection = {
  id: string;
  title: string;
  role: string;
  keyQuestion: string;
  purpose: string;
  keyMessage: string;
  slideStart: number;
  slideCount: number;
  visualFocus: SlideVisualStructure[];
};

type DeckBlueprint = {
  title: string;
  strategy: DeckStrategy;
  sections: DeckSection[];
  qaChecks: string[];
};

const structures: SlideVisualStructure[] = [
  'hero-visual', 'message-emphasis', 'card-grid', 'side-by-side-comparison', 'numbered-process', 'before-after-mapping',
  'hub-and-spoke', 'metrics-dashboard', 'roadmap', 'pyramid-framework', 'case-story', 'closing-commitment',
];
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  try {
    const payload = await req.json() as { request?: unknown };
    const request = normalizeRequest(payload.request);
    if (!request) return json({ error: 'Source text is required to create a deck blueprint.' }, 400);

    const apiKey = Deno.env.get('OPENAI_API_KEY');
    if (!apiKey) return json({ error: 'OPENAI_API_KEY is not configured.' }, 500);
    const model = Deno.env.get('OPENAI_PPT_PLAN_MODEL') ?? DEFAULT_PPT_PLAN_MODEL;

    let blueprint = await requestBlueprint(apiKey, model, request);
    let issues = validateBlueprint(blueprint, request);
    if (issues.length > 0) {
      blueprint = await requestBlueprint(apiKey, model, request, blueprint, issues);
      issues = validateBlueprint(blueprint, request);
    }
    if (issues.length > 0) return json({ error: `Deck blueprint QA failed: ${issues[0]}`, issues }, 422);

    return json({
      ...blueprint,
      qaChecks: [
        `Validated ${blueprint.sections.length} coherent sections for ${request.slideCount} slides.`,
        'Every section has a defined purpose, a key message, a page range, and visual direction before slide generation starts.',
        'Section page ranges are contiguous and add up to the requested total slide count.',
      ],
    });
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : 'Deck blueprint planning failed.' }, 500);
  }
});

async function requestBlueprint(
  apiKey: string,
  model: string,
  request: PlannerRequest,
  previousBlueprint?: DeckBlueprint,
  qaIssues: string[] = [],
): Promise<DeckBlueprint> {
  const maxSlidesPerSection = 10;
  const prompt = JSON.stringify({
    task: previousBlueprint ? 'Repair this presentation blueprint.' : 'Create a section-aware presentation blueprint before any individual slides are written.',
    requestedSlideCount: request.slideCount,
    maximumSlidesPerSection: maxSlidesPerSection,
    minimumSectionCount: Math.ceil(request.slideCount / maxSlidesPerSection),
    targetLanguage: request.targetLanguage,
    topic: request.topic,
    audience: request.audience,
    purpose: request.purpose,
    presentationDurationMinutes: request.presentationDurationMinutes,
    documentType: request.documentType,
    presentationIntent: request.presentationIntent,
    coreMessage: request.coreMessage,
    requiredSections: request.requiredSections,
    purposeTemplate: request.purposeTemplate,
    creationInstructions: request.creationInstructions,
    presentationGuide: request.presentationGuide,
    styleReference: request.styleReference,
    sourceMaterialAnalysis: request.sourceMaterialAnalysis,
    sourceText: request.sourceText,
    previousBlueprint,
    qaIssuesToFix: qaIssues,
    rules: [
      'Plan the whole deck before drafting any slide. This response is the controlling blueprint for later independent section-generation calls.',
      'Return contiguous sections in presentation order. slideStart must begin at 1 and every section must start immediately after the prior section ends.',
      `The section slideCounts must sum exactly to ${request.slideCount}. No section may exceed ${maxSlidesPerSection} slides.`,
      'Every section needs one explicit argument role, a decision-relevant keyQuestion, a key message, and a visualFocus that fits its communication work. The keyQuestion must be the question this section answers for the audience, not a generic topic label. Avoid repeating a generic card grid across sections.',
      'Use the extracted topic, purpose, audience, presentation duration, document type, and supplied coreMessage as the controlling production conditions. Map requiredSections into named sections and make the final section an action, decision, implementation, or commitment close.',
      'When purposeTemplate is supplied, preserve its defaultOutline in presentation order as the mandatory high-level table of contents. Apply all compositionRules to the section roles and visualFocus. Translate section labels into the requested target language, but do not omit a template stage.',
      'Use the selected presentationGuide to set story rhythm and visual direction. Treat sourceMaterialAnalysis dataPoints as the available numeric or tabular evidence, and availableVisuals as reference material for visual emphasis. Never invent metrics, customers, citations, or claims that are not grounded in the source.',
      'For a long deck, deliberately allocate sections for context, diagnosis, model, evidence, application, implementation, governance or risk, measurement, and conclusion as appropriate to the source.',
      'Use exactly the requested language, except permitted proper names and standard business abbreviations.',
    ],
  });
  const requestBody = JSON.stringify({
    model,
    reasoning: { effort: 'low' },
    max_output_tokens: 12000,
    input: [{ role: 'user', content: [{ type: 'input_text', text: prompt }] }],
    text: { format: { type: 'json_schema', name: 'ppt_deck_blueprint', strict: true, schema: blueprintSchema } },
  });

  const response = await fetchOpenAiWithRetry('https://api.openai.com/v1/responses', {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: requestBody,
  });
  const rawPayload = await response.text();
  const payload = parseOpenAiResponse(rawPayload, response.status);
  if (!response.ok) throw new Error(payload.error?.message ?? `OpenAI blueprint planning failed (HTTP ${response.status}).`);
  const output = extractResponseText(payload);
  if (!output) throw new Error('OpenAI blueprint planning did not include text output.');
  return parseBlueprint(output);
}

const blueprintSchema = {
  type: 'object', additionalProperties: false, required: ['title', 'strategy', 'sections'],
  properties: {
    title: { type: 'string' },
    strategy: {
      type: 'object', additionalProperties: false,
      required: ['coreThesis', 'audienceNeed', 'desiredOutcome', 'narrativeArc'],
      properties: {
        coreThesis: { type: 'string' }, audienceNeed: { type: 'string' }, desiredOutcome: { type: 'string' },
        narrativeArc: {
          type: 'array', items: {
            type: 'object', additionalProperties: false, required: ['phase', 'purpose', 'slideNumbers'],
            properties: { phase: { type: 'string' }, purpose: { type: 'string' }, slideNumbers: { type: 'array', items: { type: 'integer' } } },
          },
        },
      },
    },
    sections: {
      type: 'array', items: {
        type: 'object', additionalProperties: false,
        required: ['id', 'title', 'role', 'keyQuestion', 'purpose', 'keyMessage', 'slideStart', 'slideCount', 'visualFocus'],
        properties: {
          id: { type: 'string' }, title: { type: 'string' }, role: { type: 'string' }, keyQuestion: { type: 'string' }, purpose: { type: 'string' }, keyMessage: { type: 'string' },
          slideStart: { type: 'integer' }, slideCount: { type: 'integer' }, visualFocus: { type: 'array', items: { type: 'string', enum: structures } },
        },
      },
    },
  },
};

function parseBlueprint(output: string): DeckBlueprint {
  const value = JSON.parse(output) as Record<string, unknown>;
  const strategyValue = isRecord(value.strategy) ? value.strategy : {};
  const narrativeArc = Array.isArray(strategyValue.narrativeArc) ? strategyValue.narrativeArc : [];
  const sections = Array.isArray(value.sections) ? value.sections : [];
  return {
    title: text(value.title),
    strategy: {
      coreThesis: text(strategyValue.coreThesis),
      audienceNeed: text(strategyValue.audienceNeed),
      desiredOutcome: text(strategyValue.desiredOutcome),
      narrativeArc: narrativeArc.map((entry) => {
        const item = isRecord(entry) ? entry : {};
        return {
          phase: text(item.phase),
          purpose: text(item.purpose),
          slideNumbers: Array.isArray(item.slideNumbers) ? item.slideNumbers.filter((number): number is number => typeof number === 'number' && Number.isInteger(number) && number > 0) : [],
        };
      }),
    },
    sections: sections.map((entry, index) => {
      const item = isRecord(entry) ? entry : {};
      return {
        id: text(item.id) || `section-${index + 1}`,
        title: text(item.title),
        role: text(item.role) || defaultSectionRole(index, sections.length),
        keyQuestion: text(item.keyQuestion) || defaultSectionQuestion(index, sections.length),
        purpose: text(item.purpose),
        keyMessage: text(item.keyMessage),
        slideStart: positive(item.slideStart, index + 1),
        slideCount: positive(item.slideCount, 1),
        visualFocus: normalizeVisualFocus(item.visualFocus, index),
      };
    }),
    qaChecks: [],
  };
}

function defaultSectionRole(index: number, sectionCount: number): string {
  if (index === 0) return 'Context and decision framing';
  if (index === sectionCount - 1) return 'Action and commitment';
  return 'Evidence and recommendation building';
}

function defaultSectionQuestion(index: number, sectionCount: number): string {
  if (index === 0) return 'What decision context and audience need should frame the presentation?';
  if (index === sectionCount - 1) return 'What action, owner, or commitment should follow this presentation?';
  return 'What evidence or operating logic makes the recommendation credible?';
}

function normalizeVisualFocus(value: unknown, sectionIndex: number): SlideVisualStructure[] {
  const aliases: Record<string, SlideVisualStructure> = {
    hero: 'hero-visual',
    'hero visual': 'hero-visual',
    emphasis: 'message-emphasis',
    'message emphasis': 'message-emphasis',
    cards: 'card-grid',
    comparison: 'side-by-side-comparison',
    process: 'numbered-process',
    'before after': 'before-after-mapping',
    ecosystem: 'hub-and-spoke',
    metrics: 'metrics-dashboard',
    timeline: 'roadmap',
    pyramid: 'pyramid-framework',
    case: 'case-story',
    closing: 'closing-commitment',
  };
  const selected = Array.isArray(value)
    ? value
      .filter((structure): structure is string => typeof structure === 'string')
      .map((structure) => {
        const normalized = structure.trim().toLowerCase().replace(/[_-]+/gu, ' ');
        return structures.includes(structure as SlideVisualStructure)
          ? structure as SlideVisualStructure
          : aliases[normalized];
      })
      .filter((structure): structure is SlideVisualStructure => Boolean(structure))
    : [];

  if (selected.length > 0) return [...new Set(selected)];

  const fallbackSets: SlideVisualStructure[][] = [
    ['hero-visual', 'message-emphasis', 'card-grid'],
    ['before-after-mapping', 'side-by-side-comparison', 'hub-and-spoke'],
    ['roadmap', 'numbered-process', 'metrics-dashboard'],
    ['pyramid-framework', 'case-story', 'closing-commitment'],
  ];
  return fallbackSets[sectionIndex % fallbackSets.length];
}

function validateBlueprint(blueprint: DeckBlueprint, request: PlannerRequest): string[] {
  const issues: string[] = [];
  if (!blueprint.title || !blueprint.strategy.coreThesis || !blueprint.strategy.audienceNeed || !blueprint.strategy.desiredOutcome) issues.push('The blueprint is missing its title or deck strategy.');
  if (blueprint.strategy.narrativeArc.length < 3) issues.push('The blueprint requires a beginning, evidence-building middle, and action-oriented close.');
  if (!blueprint.sections.length) issues.push('The blueprint does not contain sections.');
  if (blueprint.sections.length < Math.ceil(request.slideCount / 10)) issues.push('The blueprint needs more sections so no section exceeds ten slides.');
  const totalSlides = blueprint.sections.reduce((sum, section) => sum + section.slideCount, 0);
  if (totalSlides !== request.slideCount) issues.push(`Expected ${request.slideCount} slides across sections but received ${totalSlides}.`);
  let expectedStart = 1;
  blueprint.sections.forEach((section) => {
    if (!section.title || !section.role || !section.keyQuestion || !section.purpose || !section.keyMessage) issues.push(`Section ${section.id} is missing a title, role, key question, purpose, or key message.`);
    if (section.slideStart !== expectedStart) issues.push(`Section ${section.id} must start at page ${expectedStart}.`);
    if (section.slideCount > 10) issues.push(`Section ${section.id} has more than ten slides.`);
    if (!section.visualFocus.length) issues.push(`Section ${section.id} needs visual direction.`);
    expectedStart += section.slideCount;
  });
  return issues;
}

function normalizeRequest(value: unknown): PlannerRequest | null {
  if (!isRecord(value) || typeof value.sourceText !== 'string' || !value.sourceText.trim()) return null;
  const styleReference = isRecord(value.styleReference) ? value.styleReference : {};
  const guide = isRecord(value.presentationGuide) ? value.presentationGuide : null;
  return {
    sourceText: value.sourceText.trim(),
    targetLanguage: value.targetLanguage === 'Korean' ? 'Korean' : 'English',
    topic: text(value.topic) || undefined,
    audience: text(value.audience) || 'General audience',
    purpose: text(value.purpose) || 'Business presentation',
    presentationDurationMinutes: typeof value.presentationDurationMinutes === 'number' && Number.isFinite(value.presentationDurationMinutes)
      ? Math.min(480, Math.max(1, Math.round(value.presentationDurationMinutes)))
      : undefined,
    documentType: text(value.documentType) || undefined,
    slideCount: typeof value.slideCount === 'number' && Number.isFinite(value.slideCount) ? Math.min(100, Math.max(2, Math.round(value.slideCount))) : 6,
    contentDensity: value.contentDensity === 'standard' || value.contentDensity === 'detailed' ? value.contentDensity : 'light',
    presentationIntent: text(value.presentationIntent) || undefined,
    coreMessage: text(value.coreMessage) || undefined,
    requiredSections: text(value.requiredSections) || undefined,
    purposeTemplate: parsePurposeTemplate(value.purposeTemplate),
    sourceMaterialAnalysis: normalizeSourceMaterialAnalysis(value.sourceMaterialAnalysis),
    creationInstructions: text(value.creationInstructions) || undefined,
    presentationGuide: guide ? {
      name: text(guide.name) || 'General presentation guide', narrativeGuide: text(guide.narrativeGuide), visualGuide: text(guide.visualGuide),
      slideRules: Array.isArray(guide.slideRules) ? guide.slideRules.map(text).filter(Boolean) : [],
    } : undefined,
    styleReference: {
      name: text(styleReference.name) || 'QLEARN', notes: text(styleReference.notes) || 'Clean, decision-oriented presentation.',
      primaryColorLabel: text(styleReference.primaryColorLabel) || 'navy', accentColorLabel: text(styleReference.accentColorLabel) || 'orange',
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

function normalizeSourceMaterialAnalysis(value: unknown): PlannerRequest['sourceMaterialAnalysis'] | undefined {
  if (!isRecord(value)) return undefined;
  const values = (input: unknown) => Array.isArray(input) ? input.map(text).filter(Boolean).slice(0, 6) : [];
  const summary = text(value.summary);
  return summary ? { summary, keyPoints: values(value.keyPoints), dataPoints: values(value.dataPoints), availableVisuals: values(value.availableVisuals), sources: Array.isArray(value.sources) ? value.sources.slice(0, 20) : [] } : undefined;
}

function parseOpenAiResponse(rawPayload: string, status: number): Record<string, unknown> & { error?: { message?: string } } {
  try { return JSON.parse(rawPayload) as Record<string, unknown> & { error?: { message?: string } }; }
  catch { throw new Error(`OpenAI returned a non-JSON response (HTTP ${status}). Please retry the deck blueprint.`); }
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

function text(value: unknown): string { return typeof value === 'string' ? value.trim() : ''; }
function positive(value: unknown, fallback: number): number { return typeof value === 'number' && Number.isInteger(value) && value > 0 ? value : fallback; }
function isRecord(value: unknown): value is Record<string, unknown> { return typeof value === 'object' && value !== null; }
function json(body: unknown, status = 200) { return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }); }
