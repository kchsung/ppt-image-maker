export type TargetLanguage = 'English' | 'Korean';

export type ContentDensity = 'light' | 'standard' | 'detailed';

export type PresentationIntent = 'executive-proposal' | 'strategy-decision' | 'education-lecture' | 'investment-deck' | 'implementation-roadmap';

export type PresentationDocumentType =
  | 'proposal'
  | 'strategy'
  | 'lecture'
  | 'investment'
  | 'roadmap'
  | 'report';

export type PresentationPurposeTemplateId =
  | 'ir'
  | 'business-proposal'
  | 'company-profile'
  | 'results-report'
  | 'education-material';

export type PptClarificationField =
  | 'purpose'
  | 'audience'
  | 'presentationDurationMinutes'
  | 'contentDensity'
  | 'styleNotes';

export interface PresentationDesignGuide {
  id: PresentationIntent;
  name: string;
  narrativeGuide: string;
  visualGuide: string;
  slideRules: string[];
}

export interface PresentationPurposeTemplate {
  id: PresentationPurposeTemplateId;
  name: string;
  description: string;
  documentType: PresentationDocumentType;
  presentationIntent: PresentationIntent;
  defaultAudience: string;
  defaultPurpose: string;
  defaultOutline: string[];
  compositionRules: string[];
}

export type SlideArchetype =
  | 'cover'
  | 'section-opener'
  | 'card-grid'
  | 'comparison'
  | 'process'
  | 'before-after'
  | 'case-dashboard'
  | 'closing';

export type SlideRole =
  | 'opening'
  | 'context'
  | 'problem-framing'
  | 'evidence'
  | 'comparison'
  | 'solution'
  | 'implementation'
  | 'case-study'
  | 'decision'
  | 'conclusion';

export type SlideVisualStructure =
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

export type SlideContentClassification =
  | 'comparison'
  | 'process'
  | 'timeline'
  | 'structure'
  | 'data'
  | 'case'
  | 'message';

export type SlideDiagramType =
  | 'none'
  | 'process'
  | 'cycle'
  | 'hierarchy'
  | 'timeline'
  | 'relationship'
  | 'change';

export interface SlideDiagramSpec {
  type: SlideDiagramType;
  rationale: string;
  nodes: string[];
}

export type SlideTableEmphasis = 'none' | 'difference' | 'key-result';

export interface SlideComparisonTableRow {
  criterion: string;
  values: string[];
  emphasis: SlideTableEmphasis;
}

export interface SlideComparisonTableSpec {
  rationale: string;
  columnHeaders: string[];
  rows: SlideComparisonTableRow[];
  highlightedRowIndex: number | null;
  keyResult: string;
}

export type SlideChartPurpose = 'comparison' | 'trend' | 'composition' | 'distribution' | 'target-progress';

export type SlideChartType = 'bar' | 'line' | 'donut' | 'histogram' | 'progress';

export interface SlideChartDatum {
  label: string;
  value: number;
}

export interface SlideChartSpec {
  purpose: SlideChartPurpose;
  type: SlideChartType;
  rationale: string;
  series: SlideChartDatum[];
  targetValue: number | null;
  highlightedIndex: number | null;
  unit: string;
  keyResult: string;
}

export type SlideMetricDirection = 'up' | 'down' | 'neutral';

export interface SlideKeyMetricSpec {
  label: string;
  displayValue: string;
  numericValue: number;
  changeText: string | null;
  direction: SlideMetricDirection;
  comparisonText: string;
  rationale: string;
}

export type SlideLayoutFamily =
  | 'hero'
  | 'message'
  | 'card'
  | 'comparison'
  | 'process'
  | 'timeline'
  | 'structure'
  | 'data'
  | 'case'
  | 'closing';

export type SlideMasterLayoutId =
  | 'cover'
  | 'agenda'
  | 'section'
  | 'content'
  | 'comparison'
  | 'chart'
  | 'conclusion';

export interface SlideMasterLayoutDefinition {
  id: SlideMasterLayoutId;
  name: string;
  purpose: string;
  supportedVisualStructures: SlideVisualStructure[];
}

export interface SlideLayoutSelection {
  classification: SlideContentClassification;
  family: SlideLayoutFamily;
  rationale: string;
}

export type SlideImagePlacement =
  | 'right-hero'
  | 'left-hero'
  | 'center-visual'
  | 'card-visual'
  | 'hub-visual'
  | 'full-bleed-visual';

export interface SlideImageSlot {
  id: string;
  purpose: string;
  placement: SlideImagePlacement;
  prompt: string;
}

export interface SlideContentBlock {
  heading: string;
  detail: string;
}

export interface SlideDependency {
  previousSlideNumber: number | null;
  questionAddressed: string;
  answerSummary: string;
  nextQuestion: string | null;
}

export interface DeckStrategy {
  coreThesis: string;
  audienceNeed: string;
  desiredOutcome: string;
  narrativeArc: Array<{
    phase: string;
    purpose: string;
    slideNumbers: number[];
  }>;
}

export interface DeckSection {
  id: string;
  title: string;
  role?: string;
  keyQuestion?: string;
  purpose: string;
  keyMessage: string;
  slideStart: number;
  slideCount: number;
  visualFocus: SlideVisualStructure[];
}

export interface PptDeckBlueprint {
  title: string;
  strategy: DeckStrategy;
  sections: DeckSection[];
  qaChecks: string[];
}

export interface StyleReference {
  id: string;
  name: string;
  notes: string;
  primaryColorLabel: string;
  accentColorLabel: string;
  templateDesign?: TemplateDesignProfile;
}

export interface TemplateDesignProfile {
  primaryColor: string;
  accentColor: string;
  primarySurfaceColor: string;
  accentSurfaceColor: string;
  signatureLayout: string;
  recommendedVisualStructures: SlideVisualStructure[];
}

export type StyleSourceMode = 'template' | 'upload';

export type SourceDocumentType = 'docx' | 'pdf' | 'pptx' | 'xlsx' | 'image';

export interface SourceDocument {
  name: string;
  type: SourceDocumentType;
  extractedCharacterCount: number;
}

export interface SourceAttachment extends SourceDocument {
  id: string;
  tableCount: number;
  imageCount: number;
  imageDataUrl?: string;
  sourceReference?: SourceReference;
}

export type SourceReferenceStatus = 'complete' | 'incomplete';

export interface SourceReference {
  id: string;
  sourceName: string;
  documentName: string;
  publicationYear: number | null;
  url: string | null;
  verifiedAt: string;
  metadataStatus: SourceReferenceStatus;
}

export interface SourceMaterialAnalysis {
  summary: string;
  keyPoints: string[];
  dataPoints: string[];
  availableVisuals: string[];
  sources?: SourceReference[];
}

export interface PptTemplate {
  id: string;
  templateNumber: number;
  label: string;
  name: string;
  description: string;
  accentColorLabel: string;
  imageUrl: string;
  storagePath: string;
}

export interface PptPlanningBatch {
  sectionId: string;
  startPage: number;
  slideCount: number;
  totalSlides: number;
  previousSlides?: Array<Pick<SlidePlan, 'pageNumber' | 'title' | 'mainMessage' | 'decision'>>;
}

export interface PptMakerRequest {
  sourceText: string;
  sourceDocument?: SourceDocument;
  sourceAttachments?: SourceAttachment[];
  sourceMaterialAnalysis?: SourceMaterialAnalysis;
  creationInstructions?: string;
  targetLanguage: TargetLanguage;
  topic?: string;
  audience: string;
  purpose: string;
  presentationDurationMinutes?: number;
  documentType?: PresentationDocumentType;
  slideCount: number;
  contentDensity?: ContentDensity;
  presentationIntent?: PresentationIntent;
  coreMessage?: string;
  requiredSections?: string;
  presentationGuide?: PresentationDesignGuide;
  purposeTemplate?: PresentationPurposeTemplate;
  deckBlueprint?: PptDeckBlueprint;
  planningBatch?: PptPlanningBatch;
  styleReference: StyleReference;
  styleImageDataUrl?: string;
  styleImageUrl?: string;
  selectedTemplateId?: string;
  logoImageDataUrl?: string;
  clarificationAnswers?: Record<string, string>;
}

export interface PptRequestAnalysis {
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
  clarifyingQuestions: PptClarifyingQuestion[];
}

export interface PptClarifyingQuestion {
  id: string;
  field: PptClarificationField;
  question: string;
  required: boolean;
  options: Array<{
    label: string;
    value: string;
  }>;
}

export interface SlidePlan {
  id: string;
  pageNumber: number;
  archetype: SlideArchetype;
  slideRole?: SlideRole;
  dependency?: SlideDependency;
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
  contentBlocks: SlideContentBlock[];
  decision: string;
  takeaway: string;
  imageSlot: SlideImageSlot;
  imagePrompt: string;
  sourceIds?: string[];
}

export interface PptDeckPlan {
  id: string;
  title: string;
  createdAt: string;
  request: PptMakerRequest;
  strategy?: DeckStrategy;
  blueprint?: PptDeckBlueprint;
  slides: SlidePlan[];
  copyQa: PptCopyQaResult;
}

export interface PptCopyQaResult {
  status: 'passed' | 'needs-review';
  checks: string[];
  issues: string[];
  redundancySuggestions?: PptRedundancySuggestion[];
  coverageSuggestions?: PptCoverageSuggestion[];
}

export type PptRedundancyKind = 'title' | 'message' | 'case' | 'diagram';

export type PptRedundancyAction = 'merge' | 'remove' | 'separate-role';

export interface PptRedundancySuggestion {
  id: string;
  slideNumbers: [number, number];
  kind: PptRedundancyKind;
  action: PptRedundancyAction;
  confidence: number;
  summary: string;
}

export type PptCoverageKind = 'solution' | 'feature' | 'kpi' | 'impact';

export interface PptCoverageSuggestion {
  id: string;
  problemSlideNumbers: number[];
  kind: PptCoverageKind;
  severity: 'required' | 'recommended';
  recommendedSlideRole: SlideRole;
  recommendedVisualStructure: SlideVisualStructure;
  summary: string;
}

export interface GeneratedSlideImage {
  id: string;
  slideId: string;
  pageNumber: number;
  title: string;
  imageDataUrl?: string;
  imageUrl?: string;
  storagePath?: string;
  generationItemId?: string;
  slotId?: string;
  prompt: string;
  provider: 'openai' | 'mock';
}

export interface GeneratedImageDeck {
  id: string;
  deckPlanId: string;
  generationJobId?: string;
  createdAt: string;
  images: GeneratedSlideImage[];
}

export interface GenerationJobItem {
  id: string;
  slideId: string;
  pageNumber: number;
}

export interface GenerationJob {
  id: string;
  status: 'pending' | 'processing' | 'succeeded' | 'failed';
  totalItems: number;
  completedItems: number;
  items: GenerationJobItem[];
}

export interface PptDocumentEnhancement {
  title: string;
  fileName: string;
  pptxUrl?: string;
  resultPath?: string;
  generationMode?: 'dom-to-pptx' | 'pptxgenjs-native' | 'pptxgenjs-native-pending' | 'claude-native' | 'claude-native-pending' | 'browser-fallback';
  pptxStatus?: 'processing' | 'succeeded' | 'failed';
  speakerNotes: Array<{
    pageNumber: number;
    note: string;
  }>;
  qaChecklist: string[];
  layouts: PptEditableSlideLayout[];
  layoutSource: 'html-css' | 'pptxgenjs' | 'claude' | 'fallback';
}

export type PptEditableTextRole =
  | 'title'
  | 'subtitle'
  | 'main-message'
  | 'label'
  | 'body'
  | 'takeaway'
  | 'footer'
  | 'logo';

export interface PptEditableTextBlock {
  id: string;
  role: PptEditableTextRole;
  text: string;
  x: number;
  y: number;
  w: number;
  h: number;
  fontSize: number;
  bold?: boolean;
  color?: string;
  align?: 'left' | 'center' | 'right';
}

export interface PptEditableShape {
  id: string;
  type: 'rect' | 'roundRect' | 'ellipse' | 'line';
  x: number;
  y: number;
  w: number;
  h: number;
  fillColor?: string;
  lineColor?: string;
  lineWidth?: number;
  transparency?: number;
}

export interface PptImageLayer {
  strategy: 'none' | 'visual-crop' | 'full-slide-reference' | 'full-slide-fallback';
  x: number;
  y: number;
  w: number;
  h: number;
  transparency?: number;
}

export interface PptEditableSlideLayout {
  pageNumber: number;
  visualStrategy: 'rebuild-with-editables' | 'image-fallback';
  imageLayer: PptImageLayer;
  textBlocks: PptEditableTextBlock[];
  shapes: PptEditableShape[];
  qaChecks: string[];
  placementConfidence?: number;
}

export interface PptMakerFormState {
  sourceText: string;
  sourceDocument: SourceDocument | null;
  sourceAttachments: SourceAttachment[];
  sourceMaterialAnalysis: SourceMaterialAnalysis | null;
  creationInstructions: string;
  targetLanguage: TargetLanguage;
  topic: string;
  audience: string;
  purpose: string;
  presentationDurationMinutes: number | null;
  documentType: PresentationDocumentType;
  slideCount: number;
  contentDensity: ContentDensity;
  presentationIntent: PresentationIntent;
  purposeTemplateId?: PresentationPurposeTemplateId;
  coreMessage: string;
  requiredSections: string;
  styleNotes: string;
  styleSourceMode: StyleSourceMode;
  selectedTemplateId: string | null;
  styleImageDataUrl: string | null;
  logoImageDataUrl: string | null;
  requestAnalysis: PptRequestAnalysis | null;
  clarificationAnswers: Record<string, string>;
}
