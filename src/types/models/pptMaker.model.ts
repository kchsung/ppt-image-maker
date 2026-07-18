export type TargetLanguage = 'English' | 'Korean';

export type SlideArchetype =
  | 'cover'
  | 'section-opener'
  | 'card-grid'
  | 'comparison'
  | 'process'
  | 'before-after'
  | 'case-dashboard'
  | 'closing';

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

export interface StyleReference {
  id: string;
  name: string;
  notes: string;
  primaryColorLabel: string;
  accentColorLabel: string;
}

export type StyleSourceMode = 'template' | 'upload';

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

export interface PptMakerRequest {
  sourceText: string;
  targetLanguage: TargetLanguage;
  audience: string;
  purpose: string;
  slideCount: number;
  styleReference: StyleReference;
  styleImageDataUrl?: string;
  styleImageUrl?: string;
  selectedTemplateId?: string;
  logoImageDataUrl?: string;
}

export interface SlidePlan {
  id: string;
  pageNumber: number;
  archetype: SlideArchetype;
  visualStructure: SlideVisualStructure;
  mainMessage: string;
  title: string;
  subtitle: string;
  labels: string[];
  takeaway: string;
  imagePrompt: string;
}

export interface PptDeckPlan {
  id: string;
  title: string;
  createdAt: string;
  request: PptMakerRequest;
  slides: SlidePlan[];
  copyQa: PptCopyQaResult;
}

export interface PptCopyQaResult {
  status: 'passed' | 'needs-review';
  checks: string[];
  issues: string[];
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
  generationMode?: 'claude-native' | 'claude-native-pending' | 'browser-fallback';
  pptxStatus?: 'processing' | 'succeeded' | 'failed';
  speakerNotes: Array<{
    pageNumber: number;
    note: string;
  }>;
  qaChecklist: string[];
  layouts: PptEditableSlideLayout[];
  layoutSource: 'claude' | 'fallback';
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
  strategy: 'visual-crop' | 'full-slide-reference' | 'full-slide-fallback';
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
  targetLanguage: TargetLanguage;
  audience: string;
  purpose: string;
  slideCount: number;
  styleNotes: string;
  styleSourceMode: StyleSourceMode;
  selectedTemplateId: string | null;
  styleImageDataUrl: string | null;
  logoImageDataUrl: string | null;
}
