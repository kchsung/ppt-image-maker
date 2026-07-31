import type {
  ContentDensity,
  PresentationDocumentType,
  PresentationIntent,
  PptMakerRequest,
  PptRequestAnalysis,
  PptClarifyingQuestion,
  SourceReference,
  SourceMaterialAnalysis,
} from '@/types/models/pptMaker.model';

const MAX_SLIDES = 100;
const KOREAN = {
  presentation: '\uBC1C\uD45C',
  lecture: '\uAC15\uC758',
  duration: '\uC2DC\uAC04',
  minutes: '\uBD84',
  investment: '\uD22C\uC790',
  pitching: '\uD53C\uCE6D',
  roadmap: '\uB85C\uB4DC\uB9F5',
  implementationPlan: '\uC2E4\uD589 \uACC4\uD68D',
  education: '\uAD50\uC721',
  workshop: '\uC6CC\uD06C\uC20D',
  strategy: '\uC804\uB7B5',
  decision: '\uC758\uC0AC\uACB0\uC815',
} as const;

const documentTypeByIntent: Record<PresentationIntent, PresentationDocumentType> = {
  'executive-proposal': 'proposal',
  'strategy-decision': 'strategy',
  'education-lecture': 'lecture',
  'investment-deck': 'investment',
  'implementation-roadmap': 'roadmap',
};

export function createLocalPptRequestAnalysis(request: PptMakerRequest): PptRequestAnalysis {
  const duration = readDuration(request.sourceText, request.creationInstructions);
  const presentationIntent = detectIntent(request);
  const slideCount = getSuggestedSlideCount(request.slideCount, duration, request.contentDensity);
  const topic = request.topic?.trim() || getTopic(request.sourceText, request.targetLanguage);

  return {
    topic,
    purpose: request.purpose.trim() || defaultPurpose(request.targetLanguage),
    audience: request.audience.trim() || defaultAudience(request.targetLanguage),
    presentationDurationMinutes: duration,
    slideCount,
    documentType: documentTypeByIntent[presentationIntent],
    presentationIntent,
    contentDensity: request.contentDensity ?? 'standard',
    coreMessage: request.coreMessage?.trim() || getCoreMessage(request.sourceText, topic),
    requiredSections: request.requiredSections?.trim() || getRequiredSections(presentationIntent, request.targetLanguage),
    rationale: [
      duration
        ? `${duration} minute delivery supports approximately ${slideCount} slides at the selected level of detail.`
        : `The requested ${slideCount} slides were retained because no presentation duration was detected.`,
      `Detected ${documentTypeByIntent[presentationIntent]} as the most likely document type from the source and instructions.`,
    ],
    sourceMaterialAnalysis: createLocalSourceMaterialAnalysis(request),
    clarifyingQuestions: getLocalClarifyingQuestions(request, duration),
  };
}

function createLocalSourceMaterialAnalysis(request: PptMakerRequest): SourceMaterialAnalysis {
  const sentences = request.sourceText
    .split(/(?<=[.!?])\s+|\r?\n/u)
    .map((value) => value.trim())
    .filter((value) => value.length >= 18);
  const keyPoints = Array.from(new Set(sentences)).slice(0, 5);
  const dataPoints = Array.from(new Set(sentences.filter((value) => /\d|%|\$|€|£|₩/u.test(value)))).slice(0, 5);
  const attachments = request.sourceAttachments ?? [];
  const availableVisuals = attachments
    .filter((attachment) => attachment.type === 'image' || attachment.imageCount > 0)
    .map((attachment) => attachment.type === 'image' ? `Image reference: ${attachment.name}` : `Embedded visual material: ${attachment.name}`)
    .slice(0, 5);

  return {
    summary: `${attachments.length > 0 ? `${attachments.length} attachment${attachments.length === 1 ? '' : 's'} were read. ` : ''}${keyPoints[0] ?? 'Source text was prepared for presentation planning.'}`,
    keyPoints,
    dataPoints,
    availableVisuals,
    sources: collectSourceReferences(request),
  };
}

function collectSourceReferences(request: PptMakerRequest): SourceReference[] {
  const attachmentSources = (request.sourceAttachments ?? [])
    .map((attachment) => attachment.sourceReference ?? createAttachmentFallbackSource(attachment));
  const textSources = Array.from(request.sourceText.matchAll(/https?:\/\/[^\s<>()]+/giu)).map((match, index) => {
    const url = match[0].replace(/[.,;:!?]+$/u, '');
    let sourceName = url;
    try { sourceName = new URL(url).hostname; } catch { /* Keep the URL when parsing fails. */ }
    return {
      id: `source-url-${index + 1}`,
      sourceName,
      documentName: sourceName,
      publicationYear: null,
      url,
      verifiedAt: new Date().toISOString().slice(0, 10),
      metadataStatus: 'incomplete' as const,
    };
  });
  return Array.from(new Map([...attachmentSources, ...textSources].map((source) => [source.url ?? source.documentName, source])).values());
}

function createAttachmentFallbackSource(attachment: NonNullable<PptMakerRequest['sourceAttachments']>[number]): SourceReference {
  const sourceName = attachment.name.replace(/\.[^.]+$/u, '').replace(/[_-]+/gu, ' ').trim() || attachment.name;
  const yearMatch = attachment.name.match(/\b(?:19|20)\d{2}\b/u);
  return {
    id: `source-${attachment.id}`,
    sourceName,
    documentName: attachment.name,
    publicationYear: yearMatch ? Number(yearMatch[0]) : null,
    url: null,
    verifiedAt: new Date().toISOString().slice(0, 10),
    metadataStatus: 'incomplete',
  };
}

function getLocalClarifyingQuestions(request: PptMakerRequest, duration: number | null): PptClarifyingQuestion[] {
  const questions: PptClarifyingQuestion[] = [];
  if (!request.purpose.trim() || /^business presentation$/iu.test(request.purpose.trim())) {
    questions.push({
      id: 'purpose', field: 'purpose', required: true,
      question: 'What should this presentation help the audience do?',
      options: [
        { label: 'Approve a decision', value: 'Support a clear decision and approval.' },
        { label: 'Learn a concept', value: 'Build understanding and practical application.' },
        { label: 'Align an execution plan', value: 'Align owners, milestones, and next actions.' },
      ],
    });
  }
  if (!request.audience.trim() || /^general audience$/iu.test(request.audience.trim())) {
    questions.push({
      id: 'audience', field: 'audience', required: true,
      question: 'Who is the primary audience?',
      options: [
        { label: 'Executive leaders', value: 'Executive leaders and decision-makers' },
        { label: 'Working team', value: 'Delivery team and functional owners' },
        { label: 'Customers or partners', value: 'Customers, partners, and external stakeholders' },
      ],
    });
  }
  if (!duration) {
    questions.push({
      id: 'duration', field: 'presentationDurationMinutes', required: true,
      question: 'How long is the presentation slot?',
      options: [
        { label: '10 minutes', value: '10' },
        { label: '20 minutes', value: '20' },
        { label: '30 minutes', value: '30' },
        { label: '45 minutes', value: '45' },
      ],
    });
  }
  if (!request.styleReference.notes.trim()) {
    questions.push({
      id: 'style', field: 'styleNotes', required: true,
      question: 'Which visual direction should guide the deck?',
      options: [
        { label: 'Executive and restrained', value: 'Executive, restrained, decision-oriented visual hierarchy.' },
        { label: 'Educational and explanatory', value: 'Educational, clear, diagram-led visual hierarchy.' },
        { label: 'Persuasive and energetic', value: 'Persuasive, high-contrast, outcome-led visual hierarchy.' },
      ],
    });
  }
  return questions;
}

function readDuration(...values: Array<string | undefined>): number | null {
  const combined = values.filter((value): value is string => typeof value === 'string').join(' ');
  const unit = `(?:minutes?|mins?|min|${KOREAN.minutes})`;
  const leading = new RegExp(`(?:presentation|talk|session|lecture|${KOREAN.presentation}|${KOREAN.lecture})\\s*(?:time|duration|${KOREAN.duration})?\\s*[:\\uFF1A]?\\s*(\\d{1,3})\\s*${unit}`, 'iu');
  const trailing = new RegExp(`(\\d{1,3})\\s*${unit}\\s*(?:presentation|talk|session|lecture|${KOREAN.presentation}|${KOREAN.lecture})`, 'iu');
  const match = combined.match(leading) ?? combined.match(trailing);
  if (!match) return null;
  const minutes = Number(match[1]);
  return Number.isFinite(minutes) && minutes > 0 ? Math.min(480, Math.round(minutes)) : null;
}

function detectIntent(request: PptMakerRequest): PresentationIntent {
  const text = [request.topic, request.purpose, request.creationInstructions, request.sourceText]
    .filter((value): value is string => typeof value === 'string')
    .join(' ')
    .toLowerCase();
  if (new RegExp(`\\b(ir|investor|funding|valuation)\\b|${KOREAN.investment}|${KOREAN.pitching}`, 'iu').test(text)) return 'investment-deck';
  if (new RegExp(`\\b(roadmap|rollout|implementation|delivery)\\b|${KOREAN.implementationPlan}|${KOREAN.roadmap}`, 'iu').test(text)) return 'implementation-roadmap';
  if (new RegExp(`\\b(lecture|course|class|workshop|training)\\b|${KOREAN.lecture}|${KOREAN.education}|${KOREAN.workshop}`, 'iu').test(text)) return 'education-lecture';
  if (new RegExp(`\\b(strategy|decision|governance)\\b|${KOREAN.strategy}|${KOREAN.decision}`, 'iu').test(text)) return 'strategy-decision';
  return request.presentationIntent ?? 'executive-proposal';
}

function getSuggestedSlideCount(currentSlideCount: number, duration: number | null, density: ContentDensity | undefined): number {
  if (!duration) return clampSlideCount(currentSlideCount);
  const minutesPerSlide = density === 'detailed' ? 2.5 : density === 'light' ? 1.25 : 1.75;
  return clampSlideCount(Math.round(duration / minutesPerSlide));
}

function getTopic(sourceText: string, language: PptMakerRequest['targetLanguage']): string {
  const firstMeaningfulLine = sourceText
    .split(/\r?\n|(?<=[.!?])\s+/u)
    .map((line) => line.replace(/^[-*#\d.)\s]+/u, '').trim())
    .find((line) => line.length >= 4);
  const fallback = language === 'Korean' ? '\uBC1C\uD45C \uC8FC\uC81C' : 'Presentation topic';
  return truncate(firstMeaningfulLine || fallback, 80);
}

function getCoreMessage(sourceText: string, topic: string): string {
  const sentence = sourceText
    .split(/(?<=[.!?])\s+|\r?\n/u)
    .map((value) => value.trim())
    .find((value) => value.length >= 25);
  return truncate(sentence || topic, 150);
}

function getRequiredSections(intent: PresentationIntent, language: PptMakerRequest['targetLanguage']): string {
  const english: Record<PresentationIntent, string> = {
    'executive-proposal': 'Opportunity, current challenge, proposed approach, proof, rollout, decision',
    'strategy-decision': 'Context, diagnosis, strategic options, recommendation, execution, decision',
    'education-lecture': 'Learning goal, key concepts, example, practice, summary, next step',
    'investment-deck': 'Problem, market, solution, traction, business model, funding ask',
    'implementation-roadmap': 'Current state, target model, workstreams, milestones, governance, next step',
  };
  const korean: Record<PresentationIntent, string> = {
    'executive-proposal': '\uAE30\uD68C, \uD604\uC7AC \uACFC\uC81C, \uC81C\uC548 \uBC29\uC2DD, \uADFC\uAC70, \uC2E4\uD589 \uACC4\uD68D, \uC758\uC0AC\uACB0\uC815',
    'strategy-decision': '\uB9E5\uB77D, \uC9C4\uB2E8, \uC804\uB7B5 \uB300\uC548, \uAD8C\uACE0\uC548, \uC2E4\uD589, \uC758\uC0AC\uACB0\uC815',
    'education-lecture': '\uD559\uC2B5 \uBAA9\uD45C, \uD575\uC2EC \uAC1C\uB150, \uC0AC\uB840, \uC2E4\uC2B5, \uC694\uC57D, \uB2E4\uC74C \uB2E8\uACC4',
    'investment-deck': '\uBB38\uC81C, \uC2DC\uC7A5, \uD574\uACB0\uCC45, \uC131\uACFC, \uBE44\uC988\uB2C8\uC2A4 \uBAA8\uB378, \uD22C\uC790 \uC694\uCCAD',
    'implementation-roadmap': '\uD604\uC7AC \uC0C1\uD0DC, \uBAA9\uD45C \uBAA8\uB378, \uC2E4\uD589 \uACFC\uC81C, \uC77C\uC815, \uAC70\uBC84\uB10C\uC2A4, \uB2E4\uC74C \uB2E8\uACC4',
  };
  return (language === 'Korean' ? korean : english)[intent];
}

function defaultPurpose(language: PptMakerRequest['targetLanguage']): string {
  return language === 'Korean'
    ? '\uC758\uC0AC\uACB0\uC815\uACFC \uC2E4\uD589\uC744 \uC704\uD55C \uBC1C\uD45C'
    : 'A presentation that supports a clear decision and action.';
}

function defaultAudience(language: PptMakerRequest['targetLanguage']): string {
  return language === 'Korean'
    ? '\uC758\uC0AC\uACB0\uC815\uC790\uC640 \uC2E4\uD589 \uCC45\uC784\uC790'
    : 'Decision-makers and accountable delivery owners';
}

function clampSlideCount(value: number): number {
  return Math.min(MAX_SLIDES, Math.max(2, Math.round(Number.isFinite(value) ? value : 6)));
}

function truncate(value: string, maxLength: number): string {
  return value.length <= maxLength ? value : `${value.slice(0, maxLength - 1).trimEnd()}...`;
}
