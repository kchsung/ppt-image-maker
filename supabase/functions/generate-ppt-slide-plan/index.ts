type TargetLanguage = 'English' | 'Korean';
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
  styleReference: { name: string; notes: string; primaryColorLabel: string; accentColorLabel: string };
};

type DraftSlide = {
  pageNumber: number;
  archetype: SlideArchetype;
  visualStructure: SlideVisualStructure;
  mainMessage: string;
  title: string;
  subtitle: string;
  labels: string[];
  takeaway: string;
  imageSlot: { id: string; purpose: string; placement: SlideImagePlacement; prompt: string };
};

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

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  try {
    const request = ((await req.json()) as { request?: PptMakerRequest }).request;
    if (!isValidRequest(request)) return json({ error: 'A complete PPT maker request is required.' }, 400);

    const apiKey = Deno.env.get('OPENAI_API_KEY');
    if (!apiKey) return json({ error: 'OPENAI_API_KEY is not configured.' }, 500);

    const model = Deno.env.get('OPENAI_PPT_PLAN_MODEL') ?? 'gpt-4o';
    let slides = ensurePlanDiversity(await requestPlan(apiKey, model, request));
    let issues = validatePlan(slides, request);
    if (issues.length > 0) {
      slides = ensurePlanDiversity(await requestPlan(apiKey, model, request, slides, issues));
      issues = validatePlan(slides, request);
    }
    if (issues.length > 0) return json({ error: `Slide copy QA failed: ${issues[0]}`, issues }, 422);

    return json({
      id: `deck-${Date.now()}`,
      title: slides[0]?.title ?? 'Untitled Deck',
      createdAt: new Date().toISOString(),
      slides: slides.map((slide) => ({
        id: `slide-${slide.pageNumber}`,
        ...slide,
        imagePrompt: slide.imageSlot.prompt,
      })),
      copyQa: {
        status: 'passed',
        checks: [
          `OpenAI created ${slides.length} validated slide drafts before visual generation.`,
          'Each slide contains editable copy, a varied native layout instruction, and one text-free visual asset slot.',
          `Validated ${request.targetLanguage} copy consistency, title fit, and clipped-text rules.`,
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
): Promise<DraftSlide[]> {
  const prompt = JSON.stringify({
    task: priorSlides ? 'Repair this slide plan while preserving useful content.' : 'Create a presentation-ready slide draft.',
    requestedSlideCount: request.slideCount,
    targetLanguage: request.targetLanguage,
    audience: request.audience,
    purpose: request.purpose,
    sourceDocument: request.sourceDocument,
    creationInstructions: request.creationInstructions ?? 'No additional instructions were provided.',
    styleReference: request.styleReference,
    sourceText: request.sourceText,
    previousSlides: priorSlides,
    qaIssuesToFix: qaIssues,
    rules: [
      'The returned text fields are the sole source for editable PowerPoint text. Do not rely on text embedded in images.',
      'Use exactly the target language. English slides must contain no Hangul. Korean slides may use only proper names plus AI, PPT, CEO, CTO, and the brand name QLEARN for Startup in English.',
      'Every slide needs a different information composition where the message calls for it. Never repeat a visualStructure on consecutive slides.',
      'Use hero-visual for the cover and closing-commitment for the final slide. Use at least four distinct visual structures in a deck of four or more slides.',
      'Write concise, complete, factual copy. No ellipses, page markers, template labels, source headers, lorem ipsum, or invented citations.',
      'Titles must fit editable PowerPoint title boxes: 42 characters maximum in English or 22 characters maximum in Korean.',
      'imageSlot describes ONE visual-only image asset. Its prompt must request an illustration, photo, icon system, or diagram WITHOUT any readable words, numbers, labels, logo, title, footer, slide frame, or full-slide composition.',
      'The native PPTX renderer will place the image only inside imageSlot.placement and draw all text, cards, arrows, metrics, and labels as editable PowerPoint objects.',
      'Treat creationInstructions as mandatory constraints unless they conflict with the requested language, source facts, or safety requirements.',
    ],
  });
  const response = await fetch('https://api.openai.com/v1/responses', {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model,
      input: [{ role: 'user', content: [{ type: 'input_text', text: prompt }] }],
      text: {
        format: {
          type: 'json_schema',
          name: 'ppt_slide_draft',
          strict: true,
          schema: planSchema,
        },
      },
    }),
  });
  const payload = await response.json() as Record<string, unknown> & { error?: { message?: string } };
  if (!response.ok) throw new Error(payload.error?.message ?? 'OpenAI slide copy planning failed.');
  const text = extractResponseText(payload);
  if (!text) throw new Error('OpenAI slide copy planning did not include text output.');
  return parsePlan(text);
}

const planSchema = {
  type: 'object', additionalProperties: false,
  required: ['slides'],
  properties: {
    slides: {
      type: 'array',
      items: {
        type: 'object', additionalProperties: false,
        required: ['pageNumber', 'archetype', 'visualStructure', 'mainMessage', 'title', 'subtitle', 'labels', 'takeaway', 'imageSlot'],
        properties: {
          pageNumber: { type: 'integer' }, archetype: { type: 'string' }, visualStructure: { type: 'string' },
          mainMessage: { type: 'string' }, title: { type: 'string' }, subtitle: { type: 'string' },
          labels: { type: 'array', items: { type: 'string' } }, takeaway: { type: 'string' },
          imageSlot: {
            type: 'object', additionalProperties: false, required: ['id', 'purpose', 'placement', 'prompt'],
            properties: { id: { type: 'string' }, purpose: { type: 'string' }, placement: { type: 'string' }, prompt: { type: 'string' } },
          },
        },
      },
    },
  },
};

function parsePlan(text: string): DraftSlide[] {
  const parsed = JSON.parse(text) as { slides?: unknown };
  if (!Array.isArray(parsed.slides)) throw new Error('OpenAI slide copy planning did not return a slides array.');
  return parsed.slides.map((value, index) => normalizeSlide(value, index + 1));
}

function normalizeSlide(value: unknown, fallbackPageNumber: number): DraftSlide {
  const record = isRecord(value) ? value : {};
  const image = isRecord(record.imageSlot) ? record.imageSlot : {};
  return {
    pageNumber: positive(record.pageNumber, fallbackPageNumber),
    archetype: archetypes.includes(record.archetype as SlideArchetype) ? record.archetype as SlideArchetype : fallbackPageNumber === 1 ? 'cover' : 'card-grid',
    visualStructure: structures.includes(record.visualStructure as SlideVisualStructure) ? record.visualStructure as SlideVisualStructure : fallbackPageNumber === 1 ? 'hero-visual' : 'card-grid',
    mainMessage: text(record.mainMessage), title: text(record.title), subtitle: text(record.subtitle),
    labels: Array.isArray(record.labels) ? record.labels.map(text).filter(Boolean).slice(0, 5) : [], takeaway: text(record.takeaway),
    imageSlot: {
      id: text(image.id) || `visual-${fallbackPageNumber}`,
      purpose: text(image.purpose),
      placement: placements.includes(image.placement as SlideImagePlacement) ? image.placement as SlideImagePlacement : 'right-hero',
      prompt: text(image.prompt),
    },
  };
}

function ensurePlanDiversity(slides: DraftSlide[]): DraftSlide[] {
  const totalSlides = slides.length;

  return slides.map((slide, index) => {
    const visualStructure = getRequiredVisualStructure(index, totalSlides);
    const archetype = getArchetypeForStructure(visualStructure, totalSlides, index);
    const placement = getPlacementForStructure(visualStructure);
    const structureInstruction = `Use a ${visualStructure} composition with illustration-only content and no typography.`;

    return {
      ...slide,
      pageNumber: index + 1,
      archetype,
      visualStructure,
      imageSlot: {
        ...slide.imageSlot,
        placement,
        prompt: `${slide.imageSlot.prompt} ${structureInstruction}`.trim(),
      },
    };
  });
}

function getRequiredVisualStructure(index: number, totalSlides: number): SlideVisualStructure {
  if (index === 0) return 'hero-visual';
  if (totalSlides > 1 && index === totalSlides - 1) return 'closing-commitment';

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
  return middleStructures[(index - 1) % middleStructures.length];
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

function getPlacementForStructure(visualStructure: SlideVisualStructure): SlideImagePlacement {
  const placementByStructure: Record<SlideVisualStructure, SlideImagePlacement> = {
    'hero-visual': 'right-hero',
    'message-emphasis': 'center-visual',
    'card-grid': 'card-visual',
    'side-by-side-comparison': 'right-hero',
    'numbered-process': 'center-visual',
    'before-after-mapping': 'center-visual',
    'hub-and-spoke': 'hub-visual',
    'metrics-dashboard': 'card-visual',
    roadmap: 'center-visual',
    'pyramid-framework': 'center-visual',
    'case-story': 'left-hero',
    'closing-commitment': 'center-visual',
  };
  return placementByStructure[visualStructure];
}

function validatePlan(slides: DraftSlide[], request: PptMakerRequest): string[] {
  const issues: string[] = [];
  if (slides.length !== request.slideCount) issues.push(`Expected ${request.slideCount} slides but received ${slides.length}.`);
  const distinct = new Set(slides.map((slide) => slide.visualStructure));
  if (request.slideCount >= 4 && distinct.size < 4) issues.push('The plan needs at least four distinct visual structures.');
  slides.forEach((slide, index) => {
    const slideNumber = index + 1;
    if (slide.pageNumber !== slideNumber) issues.push(`Slide ${slideNumber} has an invalid page number.`);
    if (index === 0 && slide.visualStructure !== 'hero-visual') issues.push('Slide 1 must use hero-visual.');
    if (slides.length > 1 && index === slides.length - 1 && slide.visualStructure !== 'closing-commitment') issues.push(`Slide ${slideNumber} must use closing-commitment.`);
    if (index > 0 && slide.visualStructure === slides[index - 1].visualStructure) issues.push(`Slides ${index} and ${slideNumber} repeat the same visual structure.`);
    if (slide.labels.length < 3) issues.push(`Slide ${slideNumber} needs at least three labels.`);
    if (!slide.imageSlot.prompt || !slide.imageSlot.purpose) issues.push(`Slide ${slideNumber} is missing an image slot.`);
    if (/(?:readable text|title|subtitle|label|footer|logo|full slide|16:9 slide)/iu.test(slide.imageSlot.prompt)) issues.push(`Slide ${slideNumber} image slot must describe a text-free visual asset.`);
    [slide.title, slide.subtitle, slide.mainMessage, slide.takeaway, ...slide.labels].forEach((value) => {
      if (!value) issues.push(`Slide ${slideNumber} has an empty text field.`);
      if (/\.{2,}|\[[^\]]*(?:page|\uD398\uC774\uC9C0)[^\]]*\]|\b(?:Designed for|Moves From|Slide Title|Key Point|Lorem ipsum)\b/iu.test(value)) issues.push(`Slide ${slideNumber} contains placeholder or clipped text.`);
      if (request.targetLanguage === 'English' && hangul.test(value)) issues.push(`Slide ${slideNumber} contains Korean text despite English being selected.`);
    });
    if (request.targetLanguage === 'English' && slide.title.length > 42) issues.push(`Slide ${slideNumber} title is too long for the editable layout.`);
    if (request.targetLanguage === 'Korean' && [...slide.title].length > 22) issues.push(`Slide ${slideNumber} title is too long for the editable layout.`);
  });
  return Array.from(new Set(issues));
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

function isValidRequest(value: unknown): value is PptMakerRequest {
  return isRecord(value) && typeof value.sourceText === 'string' && value.sourceText.trim().length > 0 &&
    (value.targetLanguage === 'English' || value.targetLanguage === 'Korean') &&
    typeof value.audience === 'string' && typeof value.purpose === 'string' &&
    typeof value.slideCount === 'number' && value.slideCount >= 1 && value.slideCount <= 20 && isRecord(value.styleReference);
}
function isRecord(value: unknown): value is Record<string, unknown> { return typeof value === 'object' && value !== null; }
function text(value: unknown): string { return typeof value === 'string' ? value.trim() : ''; }
function positive(value: unknown, fallback: number): number { return typeof value === 'number' && Number.isInteger(value) && value > 0 ? value : fallback; }
function json(data: unknown, status = 200): Response { return new Response(JSON.stringify(data), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }); }
