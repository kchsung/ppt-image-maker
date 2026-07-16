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
}

export interface SlidePlan {
  id: string;
  pageNumber: number;
  archetype: SlideArchetype;
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
  speakerNotes: Array<{
    pageNumber: number;
    note: string;
  }>;
  qaChecklist: string[];
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
}
