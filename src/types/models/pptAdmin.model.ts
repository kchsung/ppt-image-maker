import type { PptDeckPlan } from '@/types/models/pptMaker.model';

export type AdminGenerationStatus = 'pending' | 'processing' | 'succeeded' | 'failed';

export interface AdminGenerationItem {
  id: string;
  pageNumber: number;
  status: AdminGenerationStatus;
  outputPath: string | null;
  imageUrl: string | null;
  errorMessage: string | null;
  updatedAt: string;
}

export interface AdminGenerationJob {
  id: string;
  title: string;
  status: AdminGenerationStatus;
  progress: number;
  totalItems: number;
  completedItems: number;
  createdAt: string;
  updatedAt: string;
  errorMessage: string | null;
  deckPlan: PptDeckPlan | null;
  resultPath: string | null;
  pptxUrl: string | null;
  items: AdminGenerationItem[];
}

export interface SavedPptxOutput {
  resultPath: string;
  pptxUrl: string;
}

export interface AdminGenerationSummary {
  jobs: AdminGenerationJob[];
}
