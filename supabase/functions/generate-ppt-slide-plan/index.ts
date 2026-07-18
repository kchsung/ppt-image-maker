type TargetLanguage = 'English' | 'Korean';

type SlideArchetype =
  | 'cover'
  | 'section-opener'
  | 'card-grid'
  | 'comparison'
  | 'process'
  | 'before-after'
  | 'case-dashboard'
  | 'closing';

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

type PptMakerRequest = {
  sourceText: string;
  targetLanguage: TargetLanguage;
  audience: string;
  purpose: string;
  slideCount: number;
  styleReference: {
    name: string;
    notes: string;
    primaryColorLabel: string;
    accentColorLabel: string;
  };
};

type DraftSlide = {
  pageNumber: number;
  archetype: SlideArchetype;
  visualStructure: SlideVisualStructure | '';
  mainMessage: string;
  title: string;
  subtitle: string;
  labels: string[];
  takeaway: string;
};

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const SLIDE_ARCHETYPES: SlideArchetype[] = [
  'cover',
  'section-opener',
  'card-grid',
  'comparison',
  'process',
  'before-after',
  'case-dashboard',
  'closing',
];

const SLIDE_VISUAL_STRUCTURES: SlideVisualStructure[] = [
  'hero-visual',
  'message-emphasis',
  'card-grid',
  'side-by-side-comparison',
  'numbered-process',
  'before-after-mapping',
  'hub-and-spoke',
  'metrics-dashboard',
  'roadmap',
  'pyramid-framework',
  'case-story',
  'closing-commitment',
];

const HANGUL_CHARACTER_PATTERN = /[\u3131-\u318e\uac00-\ud7a3]/u;

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return json({ error: 'Method not allowed' }, 405);
  }

  try {
    const apiKey = Deno.env.get('CLAUDE_API_KEY');
    if (!apiKey) {
      return json({ error: 'CLAUDE_API_KEY is not configured.' }, 500);
    }

    const body = (await req.json()) as { request?: PptMakerRequest };
    const request = body.request;
    if (!isValidRequest(request)) {
      return json({ error: 'A complete PPT maker request is required.' }, 400);
    }

    const model = Deno.env.get('CLAUDE_MODEL') ?? 'claude-sonnet-5';
    const initialDraft = await requestCopyPlan(apiKey, model, request, []);
    const initialIssues = validateCopyPlan(initialDraft, request);
    const repairedDraft = initialIssues.length > 0
      ? await requestCopyPlan(apiKey, model, request, initialIssues, initialDraft)
      : initialDraft;
    const issues = validateCopyPlan(repairedDraft, request);

    if (issues.length > 0) {
      return json({ error: `Slide copy QA failed: ${issues[0]}`, issues }, 422);
    }

    const slides = repairedDraft.map((slide) => ({
      id: `slide-${slide.pageNumber}`,
      ...slide,
      imagePrompt: '',
    }));

    return json({
      id: `deck-${Date.now()}`,
      title: slides[0]?.title ?? 'Untitled Deck',
      createdAt: new Date().toISOString(),
      slides,
      copyQa: {
        status: 'passed',
        checks: [
          `Created ${slides.length} presentation-ready slide messages with Claude.`,
          'Removed source headers, page markers, placeholder copy, and clipped text.',
          `Validated ${request.targetLanguage} copy consistency before image generation.`,
        ],
        issues: [],
      },
    });
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : 'Unknown error' }, 500);
  }
});

async function requestCopyPlan(
  apiKey: string,
  model: string,
  request: PptMakerRequest,
  issues: string[],
  priorDraft?: DraftSlide[],
  retryEmptyResponse = false,
): Promise<DraftSlide[]> {
  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model,
      max_tokens: 5000,
      thinking: { type: 'disabled' },
      system: [
        'You are a senior Korean/English presentation strategist.',
        'Your work is the source of truth for slide copy. Never use heuristic keywords, source headers, page labels, or template placeholders as copy.',
        'Create one coherent story, preserve factual names and numbers from the source, and write concise content that fits inside editable PowerPoint text boxes.',
        'Return strict RFC 8259 JSON only. Do not wrap it in markdown. Escape quotation marks and line breaks inside text values.',
        retryEmptyResponse
          ? 'Your previous response had no usable text. Return the JSON object immediately in a text block, with no reasoning or preamble.'
          : '',
      ].join(' '),
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'text',
              text: JSON.stringify({
                task: priorDraft ? 'Repair a slide copy plan that failed QA.' : 'Create a validated slide copy plan.',
                targetLanguage: request.targetLanguage,
                audience: request.audience,
                purpose: request.purpose,
                requestedSlideCount: request.slideCount,
                styleReference: request.styleReference,
                sourceText: request.sourceText,
                previousDraft: priorDraft,
                qaFailuresToFix: issues,
                outputContract: {
                  slides: [
                    {
                      pageNumber: 'number from 1 through requestedSlideCount',
                      archetype: 'cover | section-opener | card-grid | comparison | process | before-after | case-dashboard | closing',
                      visualStructure: 'hero-visual | message-emphasis | card-grid | side-by-side-comparison | numbered-process | before-after-mapping | hub-and-spoke | metrics-dashboard | roadmap | pyramid-framework | case-story | closing-commitment',
                      mainMessage: 'one complete sentence, maximum 24 words',
                      title: 'one strong claim, maximum 12 words',
                      subtitle: 'one complete supporting sentence, maximum 18 words',
                      labels: 'array of 3 to 5 labels, each 1 to 4 words',
                      takeaway: 'one complete sentence, maximum 20 words',
                    },
                  ],
                },
                nonNegotiableRules: [
                  'Use only the requested target language. For Korean, English is allowed only for exact product names, QLEARN, AI, PPT, CEO, or CTO.',
                  'Do not use ellipses, placeholder dots, page markers, [page], [페이지], source footers, designed-for language, or template text.',
                  'Do not use phrases such as Moves From, Slide Title, Key Point, Lorem ipsum, or Designed for.',
                  'For English, write every title, sentence, label, and takeaway in English. Do not output Hangul, even when the source material is Korean.',
                  'Do not truncate a sentence. Split the idea across slides instead.',
                  'Keep each title short enough to fit a two-line presentation title box: 42 characters or fewer for English, 22 characters or fewer for Korean.',
                  'The visual will be generated without readable text, so every intended message must be in the returned fields.',
                  'Plan the presentation as a varied visual story before writing the copy. Assign a slide-specific visualStructure that fits the message, not merely the template style.',
                  'Use hero-visual for the cover and closing-commitment for the final slide. For the other slides, choose structures such as comparison, process, hub-and-spoke, roadmap, dashboard, before-after mapping, pyramid, or case story based on the argument.',
                  'Never repeat the same visualStructure on consecutive slides. Use at least min(requestedSlideCount, 4) distinct visual structures across the deck.',
                  'Each visualStructure is an explicit layout instruction for the image model. Use it to vary information hierarchy, diagram form, and whitespace while keeping one visual style system.',
                  'Return exactly the requested number of slides and no markdown.',
                ],
              }),
            },
          ],
        },
      ],
    }),
  });

  const payload = await response.json();
  if (!response.ok) {
    throw new Error(payload?.error?.message ?? 'Claude slide copy planning failed.');
  }

  const text = extractClaudeText(payload);
  if (!text) {
    if (!retryEmptyResponse) {
      return requestCopyPlan(apiKey, model, request, issues, priorDraft, true);
    }
    throw new Error(`Claude slide copy planning did not include text output. ${describeClaudeResponse(payload)}`);
  }

  const rawJson = extractJson(text);
  try {
    return parseCopyPlan(rawJson);
  } catch (error) {
    return repairMalformedCopyPlanJson(apiKey, model, rawJson, error);
  }
}

async function repairMalformedCopyPlanJson(
  apiKey: string,
  model: string,
  malformedJson: string,
  parseError: unknown,
): Promise<DraftSlide[]> {
  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model,
      max_tokens: 5000,
      system: [
        'You repair malformed JSON for a presentation slide copy plan.',
        'Return only valid RFC 8259 JSON with a top-level slides array. Do not add markdown, explanations, or new slide content.',
        'Preserve the intended slide content while fixing JSON syntax, including escaping quotation marks and line breaks inside strings.',
      ].join(' '),
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'text',
              text: JSON.stringify({
                task: 'Repair this malformed slide copy plan JSON so it can be parsed without changing its intent.',
                parserError: parseError instanceof Error ? parseError.message : 'Invalid JSON.',
                malformedJson,
                requiredShape: {
                  slides: [
                    {
                      pageNumber: 'number',
                      archetype: 'string',
                      visualStructure: 'string',
                      mainMessage: 'string',
                      title: 'string',
                      subtitle: 'string',
                      labels: ['string'],
                      takeaway: 'string',
                    },
                  ],
                },
              }),
            },
          ],
        },
      ],
    }),
  });

  const payload = await response.json();
  if (!response.ok) {
    throw new Error(payload?.error?.message ?? 'Claude could not repair the malformed slide copy plan.');
  }

  const text = extractClaudeText(payload);
  if (!text) {
    throw new Error('Claude JSON repair did not include text output.');
  }

  try {
    return parseCopyPlan(extractJson(text));
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Invalid JSON.';
    throw new Error(`Claude JSON repair did not return a valid slide copy plan: ${message}`);
  }
}

function parseCopyPlan(jsonText: string): DraftSlide[] {
  const parsed = JSON.parse(jsonText) as { slides?: unknown };
  if (!Array.isArray(parsed.slides)) {
    throw new Error('Claude slide copy planning did not return a slides array.');
  }

  return parsed.slides.map((value, index) => normalizeSlide(value, index + 1));
}

function normalizeSlide(value: unknown, fallbackPageNumber: number): DraftSlide {
  const record = isRecord(value) ? value : {};
  const pageNumber = toPositiveNumber(record.pageNumber, fallbackPageNumber);
  const archetype = SLIDE_ARCHETYPES.includes(record.archetype as SlideArchetype)
    ? (record.archetype as SlideArchetype)
    : fallbackPageNumber === 1
      ? 'cover'
      : 'card-grid';
  const visualStructure = SLIDE_VISUAL_STRUCTURES.includes(record.visualStructure as SlideVisualStructure)
    ? record.visualStructure as SlideVisualStructure
    : '';

  return {
    pageNumber,
    archetype,
    visualStructure,
    mainMessage: toText(record.mainMessage),
    title: toText(record.title),
    subtitle: toText(record.subtitle),
    labels: Array.isArray(record.labels) ? record.labels.map(toText).filter(Boolean).slice(0, 5) : [],
    takeaway: toText(record.takeaway),
  };
}

function validateCopyPlan(slides: DraftSlide[], request: PptMakerRequest): string[] {
  const issues: string[] = [];
  if (slides.length !== request.slideCount) {
    issues.push(`Expected ${request.slideCount} slides but received ${slides.length}.`);
  }

  slides.forEach((slide, index) => {
    if (slide.pageNumber !== index + 1) {
      issues.push(`Slide ${index + 1} has an invalid page number.`);
    }
    if (slide.labels.length < 3) {
      issues.push(`Slide ${index + 1} needs at least three labels.`);
    }
    if (!slide.visualStructure) {
      issues.push(`Slide ${index + 1} is missing a valid visual structure.`);
    }
    if (isTitleTooLong(slide.title, request.targetLanguage)) {
      issues.push(`Slide ${index + 1} title is too long for the editable layout.`);
    }

    [slide.title, slide.subtitle, slide.mainMessage, slide.takeaway, ...slide.labels].forEach((text) => {
      if (!text) {
        issues.push(`Slide ${index + 1} has an empty text field.`);
      }
      if (/\.{2,}|…|\[[^\]]*(?:page|페이지)[^\]]*\]|\b(?:Designed for|Moves From|Slide Title|Key Point|Lorem ipsum)\b/iu.test(text)) {
        issues.push(`Slide ${index + 1} contains placeholder or clipped text.`);
      }
      if (request.targetLanguage === 'Korean' && containsUnapprovedEnglish(text)) {
        issues.push(`Slide ${index + 1} mixes unapproved English copy.`);
      }
      if (request.targetLanguage === 'English' && containsHangul(text)) {
        issues.push(`Slide ${index + 1} contains Korean copy while English was requested.`);
      }
    });
  });

  const visualStructures = slides.map((slide) => slide.visualStructure).filter(Boolean);
  const minimumDistinctStructures = Math.min(request.slideCount, 4);
  if (new Set(visualStructures).size < minimumDistinctStructures) {
    issues.push(`Deck needs at least ${minimumDistinctStructures} distinct visual structures.`);
  }
  visualStructures.forEach((visualStructure, index) => {
    if (index > 0 && visualStructure === visualStructures[index - 1]) {
      issues.push(`Slides ${index} and ${index + 1} repeat the same visual structure.`);
    }
  });
  if (slides[0]?.visualStructure !== 'hero-visual') {
    issues.push('Slide 1 must use the hero-visual structure.');
  }
  if (slides.length > 1 && slides.at(-1)?.visualStructure !== 'closing-commitment') {
    issues.push(`Slide ${slides.length} must use the closing-commitment structure.`);
  }

  return Array.from(new Set(issues));
}

function containsUnapprovedEnglish(value: string): boolean {
  const words = value.match(/[A-Za-z][A-Za-z-]*/g) ?? [];
  return words.some((word) => !['AI', 'QLEARN', 'PPT', 'CEO', 'CTO'].includes(word));
}

function containsHangul(value: string): boolean {
  return HANGUL_CHARACTER_PATTERN.test(value);
}

function isTitleTooLong(value: string, targetLanguage: TargetLanguage): boolean {
  const compact = value.replace(/\s+/g, ' ').trim();
  return targetLanguage === 'Korean' ? compact.length > 22 : compact.length > 42;
}

function isValidRequest(value: unknown): value is PptMakerRequest {
  return isRecord(value) && typeof value.sourceText === 'string' && isTargetLanguage(value.targetLanguage) &&
    typeof value.slideCount === 'number' && value.slideCount > 0;
}

function isTargetLanguage(value: unknown): value is TargetLanguage {
  return value === 'English' || value === 'Korean';
}

function extractClaudeText(payload: Record<string, unknown>): string | null {
  const directText = [payload.output_text, payload.completion]
    .find((value): value is string => typeof value === 'string' && value.trim().length > 0);
  if (directText) {
    return directText.trim();
  }

  const content = payload.content;
  if (!Array.isArray(content)) {
    return null;
  }

  return content
    .map((part) => {
      if (!isRecord(part)) return '';
      if (typeof part.text === 'string') return part.text;
      if (typeof part.content === 'string') return part.content;
      return '';
    })
    .join('\n')
    .trim() || null;
}

function describeClaudeResponse(payload: Record<string, unknown>): string {
  const stopReason = typeof payload.stop_reason === 'string' ? payload.stop_reason : 'unknown';
  const contentTypes = Array.isArray(payload.content)
    ? payload.content.map((part) => isRecord(part) && typeof part.type === 'string' ? part.type : 'unknown').join(', ') || 'none'
    : 'none';
  return `Claude stop reason: ${stopReason}; content block types: ${contentTypes}.`;
}

function extractJson(text: string): string {
  const trimmed = text.trim();
  if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
    return trimmed;
  }
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/iu);
  if (fenced?.[1]) {
    return fenced[1].trim();
  }
  const start = trimmed.indexOf('{');
  const end = trimmed.lastIndexOf('}');
  if (start >= 0 && end > start) {
    return trimmed.slice(start, end + 1);
  }
  throw new Error('Claude slide copy planning did not return valid JSON.');
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function toText(value: unknown): string {
  return typeof value === 'string' ? value.replace(/\s+/g, ' ').trim() : '';
}

function toPositiveNumber(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isInteger(value) && value > 0 ? value : fallback;
}

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      ...corsHeaders,
      'Content-Type': 'application/json',
    },
  });
}
