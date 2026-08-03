import type {
  GenerationJob,
  PptDeckBlueprint,
  PptDeckPlan,
  PptMakerRequest,
  PptRequestAnalysis,
} from '@/types/models/pptMaker.model';

export type PptExternalApiAction =
  | 'analyze-request'
  | 'create-blueprint'
  | 'create-section-plan'
  | 'create-job'
  | 'save-pptx'
  | 'get-job';

export interface PptExternalApiConfig {
  baseUrl: string;
  apiKey: string;
  fetcher?: typeof fetch;
}

export interface ExternalPptGenerationStatus {
  id: string;
  title: string;
  status: 'pending' | 'processing' | 'succeeded' | 'failed';
  progress: number;
  totalItems: number;
  completedItems: number;
  pptxStatus: 'not-started' | 'processing' | 'succeeded' | 'failed';
  pptxUrl: string | null;
  resultPath: string | null;
  errorMessage: string | null;
  createdAt: string | null;
  updatedAt: string | null;
}

export interface ExternalPptxSaveResult {
  resultPath: string;
  pptxUrl: string;
}

export interface PptExternalApiClient {
  analyzeRequest(request: PptMakerRequest): Promise<PptRequestAnalysis>;
  createBlueprint(request: PptMakerRequest): Promise<PptDeckBlueprint>;
  createSectionPlan(request: PptMakerRequest): Promise<PptDeckPlan>;
  createJob(deckPlan: PptDeckPlan): Promise<GenerationJob | null>;
  savePptx(input: { jobId: string; fileName: string; pptxBase64: string }): Promise<ExternalPptxSaveResult>;
  getJob(jobId: string): Promise<ExternalPptGenerationStatus>;
}
