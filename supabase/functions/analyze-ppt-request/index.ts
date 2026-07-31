type TargetLanguage = 'English' | 'Korean';
import { DEFAULT_PPT_PLAN_MODEL, fetchOpenAiWithRetry } from '../_shared/openaiRetry.ts';
type ContentDensity = 'light' | 'standard' | 'detailed';
type PresentationIntent = 'executive-proposal' | 'strategy-decision' | 'education-lecture' | 'investment-deck' | 'implementation-roadmap';
type PresentationDocumentType = 'proposal' | 'strategy' | 'lecture' | 'investment' | 'roadmap' | 'report';
type ClarificationField = 'purpose' | 'audience' | 'presentationDurationMinutes' | 'contentDensity' | 'styleNotes';
type SourceDocumentType = 'docx' | 'pdf' | 'pptx' | 'xlsx' | 'image';

type SourceAttachment = {
  id: string;
  name: string;
  type: SourceDocumentType;
  extractedCharacterCount: number;
  tableCount: number;
  imageCount: number;
  imageDataUrl?: string;
  sourceReference?: SourceReference;
};

type SourceReference = { id: string; sourceName: string; documentName: string; publicationYear: number | null; url: string | null; verifiedAt: string; metadataStatus: 'complete' | 'incomplete' };

type SourceMaterialAnalysis = {
  summary: string;
  keyPoints: string[];
  dataPoints: string[];
  availableVisuals: string[];
  sources: SourceReference[];
};

type PurposeTemplate = {
  id: string;
  name: string;
  description: string;
  documentType: PresentationDocumentType;
  presentationIntent: PresentationIntent;
  defaultOutline: string[];
  compositionRules: string[];
};

type AnalysisRequest = {
  sourceText: string;
  creationInstructions?: string;
  targetLanguage: TargetLanguage;
  topic?: string;
  audience?: string;
  purpose?: string;
  presentationDurationMinutes?: number;
  documentType?: PresentationDocumentType;
  slideCount?: number;
  contentDensity?: ContentDensity;
  presentationIntent?: PresentationIntent;
  coreMessage?: string;
  requiredSections?: string;
  purposeTemplate?: PurposeTemplate;
  clarificationAnswers?: Record<string, string>;
  sourceAttachments?: SourceAttachment[];
};

type RequestAnalysis = {
  topic: string;
  purpose: string;
  audience: string;
  presentationDurationMinutes: number | null;
  slideCount: number;
  documentType: PresentationDocumentType;
  presentationIntent: PresentationIntent;
  contentDensity: ContentDensity;
  coreMessage: string;
  requiredSections: string;
  rationale: string[];
  sourceMaterialAnalysis: SourceMaterialAnalysis;
  clarifyingQuestions: ClarifyingQuestion[];
};

type ClarifyingQuestion = {
  id: string;
  field: ClarificationField;
  question: string;
  required: boolean;
  options: Array<{ label: string; value: string }>;
};

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const intentValues: PresentationIntent[] = [
  'executive-proposal',
  'strategy-decision',
  'education-lecture',
  'investment-deck',
  'implementation-roadmap',
];
const documentTypeValues: PresentationDocumentType[] = ['proposal', 'strategy', 'lecture', 'investment', 'roadmap', 'report'];
const densityValues: ContentDensity[] = ['light', 'standard', 'detailed'];
const clarificationFields: ClarificationField[] = ['purpose', 'audience', 'presentationDurationMinutes', 'contentDensity', 'styleNotes'];

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  try {
    const body = await req.json() as { request?: unknown };
    const request = normalizeRequest(body.request);
    if (!request) return json({ error: 'Source text is required to analyze PPT production conditions.' }, 400);

    const apiKey = Deno.env.get('OPENAI_API_KEY');
    if (!apiKey) return json({ error: 'OPENAI_API_KEY is not configured.' }, 500);
    const model = Deno.env.get('OPENAI_PPT_PLAN_MODEL') ?? DEFAULT_PPT_PLAN_MODEL;
    const analysis = withSourceRegistry(applyPurposeTemplate(ensureRequiredClarifications(await requestAnalysis(apiKey, model, request), request), request), request);
    const issues = validateAnalysis(analysis);
    if (issues.length > 0) return json({ error: `PPT request analysis failed: ${issues[0]}`, issues }, 422);

    return json(analysis);
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : 'PPT request analysis failed.' }, 500);
  }
});

async function requestAnalysis(apiKey: string, model: string, request: AnalysisRequest): Promise<RequestAnalysis> {
  const prompt = JSON.stringify({
    task: 'Extract and normalize the production conditions for an editable PowerPoint deck before the deck blueprint is planned.',
    targetLanguage: request.targetLanguage,
    currentConditions: {
      topic: request.topic,
      purpose: request.purpose,
      audience: request.audience,
      presentationDurationMinutes: request.presentationDurationMinutes,
      slideCount: request.slideCount,
      documentType: request.documentType,
      presentationIntent: request.presentationIntent,
      contentDensity: request.contentDensity,
      coreMessage: request.coreMessage,
      requiredSections: request.requiredSections,
      purposeTemplate: request.purposeTemplate,
      clarificationAnswers: request.clarificationAnswers,
    },
    sourceAttachments: request.sourceAttachments?.map((attachment) => ({
      name: attachment.name,
      type: attachment.type,
      extractedCharacterCount: attachment.extractedCharacterCount,
      tableCount: attachment.tableCount,
      imageCount: attachment.imageCount,
      sourceReference: attachment.sourceReference,
    })),
    creationInstructions: request.creationInstructions,
    sourceText: request.sourceText,
    rules: [
      'Use the source and explicit instructions as the primary evidence. Preserve explicit user-provided values unless the source clearly requires a correction.',
      'Extract topic, purpose, audience, presentation duration in minutes when explicitly stated or strongly implied, recommended slideCount, documentType, presentationIntent, contentDensity, coreMessage, and requiredSections.',
      'When duration is unknown, return null. Keep slideCount between 2 and 100. If duration is known, recommend a realistic count based on the requested content density.',
      'topic must be a concise subject, purpose must state the decision or learning outcome, and audience must identify the target group.',
      'documentType must be one of proposal, strategy, lecture, investment, roadmap, report. presentationIntent must be one of executive-proposal, strategy-decision, education-lecture, investment-deck, implementation-roadmap.',
      'When a purposeTemplate is supplied, it is a mandatory production contract. Keep its documentType and presentationIntent, retain every outline stage in the requiredSections, and apply every composition rule while adapting natural-language labels to the requested target language.',
      'Use exactly the requested target language for natural-language fields, except permitted product names and standard abbreviations.',
      'Do not invent facts, metrics, stakeholders, timing, or source claims. rationale must contain two concise explanations of the classification and slide-count recommendation.',
      'Create sourceMaterialAnalysis from all text, spreadsheet rows, and attached image references: summary, 3-6 keyPoints, 0-6 dataPoints that preserve available numeric or tabular evidence, and availableVisuals. Never fabricate a metric or claim that is not present in the source materials.',
      'When purpose, audience, duration, content detail, or style direction cannot be inferred safely, return a concise required clarifying question. Each question must offer 2 to 4 selectable options and use field purpose, audience, presentationDurationMinutes, contentDensity, or styleNotes. Do not ask a question for a condition that is explicit and reliable.',
    ],
  });
  const response = await fetchOpenAiWithRetry('https://api.openai.com/v1/responses', {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model,
      // GPT-5 reasoning uses the same output budget as the structured result.
      // Keep reasoning focused and reserve enough room for the final JSON payload.
      reasoning: { effort: 'low' },
      max_output_tokens: 5000,
      input: [{ role: 'user', content: [
        { type: 'input_text', text: prompt },
        ...(request.sourceAttachments ?? [])
          .filter((attachment) => attachment.type === 'image' && attachment.imageDataUrl)
          .slice(0, 3)
          .map((attachment) => ({ type: 'input_image', image_url: attachment.imageDataUrl! })),
      ] }],
      text: { format: { type: 'json_schema', name: 'ppt_request_analysis', strict: true, schema: analysisSchema } },
    }),
  });
  const rawPayload = await response.text();
  const payload = parseOpenAiResponse(rawPayload, response.status);
  if (!response.ok) throw new Error(payload.error?.message ?? `OpenAI request analysis failed (HTTP ${response.status}).`);
  const output = extractResponseText(payload);
  if (!output) throw new Error('OpenAI request analysis did not include text output.');
  return parseAnalysis(output);
}

const analysisSchema = {
  type: 'object', additionalProperties: false,
  required: ['topic', 'purpose', 'audience', 'presentationDurationMinutes', 'slideCount', 'documentType', 'presentationIntent', 'contentDensity', 'coreMessage', 'requiredSections', 'rationale', 'sourceMaterialAnalysis', 'clarifyingQuestions'],
  properties: {
    topic: { type: 'string' }, purpose: { type: 'string' }, audience: { type: 'string' },
    presentationDurationMinutes: { type: ['integer', 'null'] }, slideCount: { type: 'integer' },
    documentType: { type: 'string', enum: documentTypeValues }, presentationIntent: { type: 'string', enum: intentValues },
    contentDensity: { type: 'string', enum: densityValues }, coreMessage: { type: 'string' }, requiredSections: { type: 'string' },
    rationale: { type: 'array', items: { type: 'string' } },
    sourceMaterialAnalysis: {
      type: 'object', additionalProperties: false,
      required: ['summary', 'keyPoints', 'dataPoints', 'availableVisuals'],
      properties: {
        summary: { type: 'string' },
        keyPoints: { type: 'array', items: { type: 'string' } },
        dataPoints: { type: 'array', items: { type: 'string' } },
        availableVisuals: { type: 'array', items: { type: 'string' } },
      },
    },
    clarifyingQuestions: {
      type: 'array',
      items: {
        type: 'object', additionalProperties: false,
        required: ['id', 'field', 'question', 'required', 'options'],
        properties: {
          id: { type: 'string' }, field: { type: 'string', enum: clarificationFields }, question: { type: 'string' }, required: { type: 'boolean' },
          options: {
            type: 'array',
            items: {
              type: 'object', additionalProperties: false, required: ['label', 'value'],
              properties: { label: { type: 'string' }, value: { type: 'string' } },
            },
          },
        },
      },
    },
  },
};

function normalizeRequest(value: unknown): AnalysisRequest | null {
  if (!isRecord(value) || typeof value.sourceText !== 'string' || !value.sourceText.trim()) return null;
  return {
    sourceText: value.sourceText.trim(),
    creationInstructions: text(value.creationInstructions) || undefined,
    targetLanguage: value.targetLanguage === 'Korean' ? 'Korean' : 'English',
    topic: text(value.topic) || undefined,
    audience: text(value.audience) || undefined,
    purpose: text(value.purpose) || undefined,
    presentationDurationMinutes: nullableMinutes(value.presentationDurationMinutes),
    documentType: isDocumentType(value.documentType) ? value.documentType : undefined,
    slideCount: positiveInteger(value.slideCount, 6),
    contentDensity: isDensity(value.contentDensity) ? value.contentDensity : 'standard',
    presentationIntent: isIntent(value.presentationIntent) ? value.presentationIntent : undefined,
    coreMessage: text(value.coreMessage) || undefined,
    requiredSections: text(value.requiredSections) || undefined,
    purposeTemplate: parsePurposeTemplate(value.purposeTemplate),
    clarificationAnswers: isRecord(value.clarificationAnswers)
      ? Object.fromEntries(Object.entries(value.clarificationAnswers).filter(([, answer]) => typeof answer === 'string').map(([id, answer]) => [id, answer.trim()]))
      : undefined,
    sourceAttachments: parseSourceAttachments(value.sourceAttachments),
  };
}

function parsePurposeTemplate(value: unknown): PurposeTemplate | undefined {
  if (!isRecord(value) || !isDocumentType(value.documentType) || !isIntent(value.presentationIntent)) return undefined;
  const id = text(value.id);
  const name = text(value.name);
  if (!id || !name) return undefined;
  return {
    id,
    name,
    description: text(value.description),
    documentType: value.documentType,
    presentationIntent: value.presentationIntent,
    defaultOutline: stringArray(value.defaultOutline, 12),
    compositionRules: stringArray(value.compositionRules, 8),
  };
}

function applyPurposeTemplate(analysis: RequestAnalysis, request: AnalysisRequest): RequestAnalysis {
  const template = request.purposeTemplate;
  if (!template) return analysis;
  const sections = [...template.defaultOutline, ...analysis.requiredSections.split(/[,\n]/u)]
    .map((section) => section.trim())
    .filter(Boolean);
  const uniqueSections = sections.filter((section, index) =>
    sections.findIndex((candidate) => candidate.toLocaleLowerCase() === section.toLocaleLowerCase()) === index,
  );
  return {
    ...analysis,
    documentType: template.documentType,
    presentationIntent: template.presentationIntent,
    requiredSections: uniqueSections.join(', '),
  };
}

function parseAnalysis(output: string): RequestAnalysis {
  const value = JSON.parse(output) as Record<string, unknown>;
  return {
    topic: text(value.topic), purpose: text(value.purpose), audience: text(value.audience),
    presentationDurationMinutes: nullableMinutes(value.presentationDurationMinutes),
    slideCount: positiveInteger(value.slideCount, 6),
    documentType: isDocumentType(value.documentType) ? value.documentType : 'proposal',
    presentationIntent: isIntent(value.presentationIntent) ? value.presentationIntent : 'executive-proposal',
    contentDensity: isDensity(value.contentDensity) ? value.contentDensity : 'standard',
    coreMessage: text(value.coreMessage), requiredSections: text(value.requiredSections),
    rationale: Array.isArray(value.rationale) ? value.rationale.map(text).filter(Boolean).slice(0, 3) : [],
    sourceMaterialAnalysis: parseSourceMaterialAnalysis(value.sourceMaterialAnalysis),
    clarifyingQuestions: parseClarifyingQuestions(value.clarifyingQuestions),
  };
}

function parseSourceAttachments(value: unknown): SourceAttachment[] {
  if (!Array.isArray(value)) return [];
  return value.map((entry) => {
    const item = isRecord(entry) ? entry : {};
    const type = isSourceDocumentType(item.type) ? item.type : null;
    const imageDataUrl = text(item.imageDataUrl);
    return {
      id: text(item.id), name: text(item.name), type: type ?? 'pdf',
      extractedCharacterCount: nonNegativeInteger(item.extractedCharacterCount),
      tableCount: nonNegativeInteger(item.tableCount), imageCount: nonNegativeInteger(item.imageCount),
      imageDataUrl: imageDataUrl.startsWith('data:image/') ? imageDataUrl : undefined,
      sourceReference: parseSourceReference(item.sourceReference),
    };
  }).filter((attachment) => attachment.id && attachment.name).slice(0, 8);
}

function parseSourceMaterialAnalysis(value: unknown): SourceMaterialAnalysis {
  const item = isRecord(value) ? value : {};
  return {
    summary: text(item.summary),
    keyPoints: stringArray(item.keyPoints, 6),
    dataPoints: stringArray(item.dataPoints, 6),
    availableVisuals: stringArray(item.availableVisuals, 6),
    sources: [],
  };
}

function parseSourceReference(value: unknown): SourceReference | undefined {
  if (!isRecord(value)) return undefined;
  const id = text(value.id);
  const sourceName = text(value.sourceName);
  const documentName = text(value.documentName);
  if (!id || !sourceName || !documentName) return undefined;
  return {
    id, sourceName, documentName,
    publicationYear: typeof value.publicationYear === 'number' && Number.isInteger(value.publicationYear) ? value.publicationYear : null,
    url: text(value.url) || null,
    verifiedAt: /^\d{4}-\d{2}-\d{2}$/u.test(text(value.verifiedAt)) ? text(value.verifiedAt) : new Date().toISOString().slice(0, 10),
    metadataStatus: value.metadataStatus === 'complete' ? 'complete' : 'incomplete',
  };
}

function withSourceRegistry(analysis: RequestAnalysis, request: AnalysisRequest): RequestAnalysis {
  const attachments = (request.sourceAttachments ?? []).map((attachment) => attachment.sourceReference ?? fallbackAttachmentSource(attachment));
  const urls = Array.from(request.sourceText.matchAll(/https?:\/\/[^\s<>()]+/giu)).map((match, index) => {
    const url = match[0].replace(/[.,;:!?]+$/u, '');
    let sourceName = url;
    try { sourceName = new URL(url).hostname; } catch { /* Preserve the URL when parsing fails. */ }
    return { id: `source-url-${index + 1}`, sourceName, documentName: sourceName, publicationYear: null, url, verifiedAt: new Date().toISOString().slice(0, 10), metadataStatus: 'incomplete' as const };
  });
  const sources = Array.from(new Map([...attachments, ...urls].map((source) => [source.url ?? source.documentName, source])).values());
  return { ...analysis, sourceMaterialAnalysis: { ...analysis.sourceMaterialAnalysis, sources } };
}

function fallbackAttachmentSource(attachment: SourceAttachment): SourceReference {
  const sourceName = attachment.name.replace(/\.[^.]+$/u, '').replace(/[_-]+/gu, ' ').trim() || attachment.name;
  const yearMatch = attachment.name.match(/\b(?:19|20)\d{2}\b/u);
  return { id: `source-${attachment.id}`, sourceName, documentName: attachment.name, publicationYear: yearMatch ? Number(yearMatch[0]) : null, url: null, verifiedAt: new Date().toISOString().slice(0, 10), metadataStatus: 'incomplete' };
}

function parseClarifyingQuestions(value: unknown): ClarifyingQuestion[] {
  if (!Array.isArray(value)) return [];
  return value.map((entry) => {
    const question = isRecord(entry) ? entry : {};
    const options = Array.isArray(question.options)
      ? question.options.map((option) => {
        const item = isRecord(option) ? option : {};
        return { label: text(item.label), value: text(item.value) };
      }).filter((option) => option.label && option.value).slice(0, 4)
      : [];
    return {
      id: text(question.id),
      field: isClarificationField(question.field) ? question.field : 'purpose',
      question: text(question.question),
      required: question.required === true,
      options,
    };
  }).filter((question) => question.id && question.question && question.options.length >= 2).slice(0, 4);
}

function ensureRequiredClarifications(analysis: RequestAnalysis, request: AnalysisRequest): RequestAnalysis {
  if (analysis.presentationDurationMinutes !== null || analysis.clarifyingQuestions.some((question) => question.field === 'presentationDurationMinutes')) {
    return analysis;
  }
  return {
    ...analysis,
    clarifyingQuestions: [
      ...analysis.clarifyingQuestions,
      {
        id: 'duration', field: 'presentationDurationMinutes', required: true,
        question: request.targetLanguage === 'Korean' ? '\uBC1C\uD45C \uC2DC\uAC04\uC744 \uC120\uD0DD\uD574 \uC8FC\uC138\uC694.' : 'How long is the presentation slot?',
        options: [
          { label: '10 minutes', value: '10' }, { label: '20 minutes', value: '20' },
          { label: '30 minutes', value: '30' }, { label: '45 minutes', value: '45' },
        ],
      },
    ],
  };
}

function validateAnalysis(analysis: RequestAnalysis): string[] {
  const issues: string[] = [];
  if (!analysis.topic || !analysis.purpose || !analysis.audience || !analysis.coreMessage || !analysis.requiredSections) issues.push('The analysis did not return all required production conditions.');
  if (analysis.slideCount < 2 || analysis.slideCount > 100) issues.push('The recommended slide count must be between 2 and 100.');
  if (analysis.presentationDurationMinutes !== null && (analysis.presentationDurationMinutes < 1 || analysis.presentationDurationMinutes > 480)) issues.push('Presentation duration must be between 1 and 480 minutes when provided.');
  if (analysis.rationale.length < 2) issues.push('The analysis needs two rationale statements.');
  if (!analysis.sourceMaterialAnalysis.summary || analysis.sourceMaterialAnalysis.keyPoints.length === 0) issues.push('The analysis needs a usable source-material summary.');
  if (analysis.clarifyingQuestions.some((question) => question.options.length < 2)) issues.push('Each clarifying question needs at least two selectable options.');
  return issues;
}

function parseOpenAiResponse(rawPayload: string, status: number): Record<string, unknown> & { error?: { message?: string } } {
  try { return JSON.parse(rawPayload) as Record<string, unknown> & { error?: { message?: string } }; }
  catch { throw new Error(`OpenAI returned a non-JSON response (HTTP ${status}). Please retry request analysis.`); }
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
function stringArray(value: unknown, limit: number): string[] { return Array.isArray(value) ? value.map(text).filter(Boolean).slice(0, limit) : []; }
function nonNegativeInteger(value: unknown): number { return typeof value === 'number' && Number.isFinite(value) ? Math.max(0, Math.round(value)) : 0; }
function positiveInteger(value: unknown, fallback: number): number { return typeof value === 'number' && Number.isInteger(value) ? Math.min(100, Math.max(2, value)) : fallback; }
function nullableMinutes(value: unknown): number | null { return typeof value === 'number' && Number.isFinite(value) ? Math.min(480, Math.max(1, Math.round(value))) : null; }
function isRecord(value: unknown): value is Record<string, unknown> { return typeof value === 'object' && value !== null; }
function isIntent(value: unknown): value is PresentationIntent { return typeof value === 'string' && intentValues.includes(value as PresentationIntent); }
function isDocumentType(value: unknown): value is PresentationDocumentType { return typeof value === 'string' && documentTypeValues.includes(value as PresentationDocumentType); }
function isDensity(value: unknown): value is ContentDensity { return typeof value === 'string' && densityValues.includes(value as ContentDensity); }
function isClarificationField(value: unknown): value is ClarificationField { return typeof value === 'string' && clarificationFields.includes(value as ClarificationField); }
function isSourceDocumentType(value: unknown): value is SourceDocumentType { return typeof value === 'string' && ['docx', 'pdf', 'pptx', 'xlsx', 'image'].includes(value); }
function json(body: unknown, status = 200) { return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }); }
