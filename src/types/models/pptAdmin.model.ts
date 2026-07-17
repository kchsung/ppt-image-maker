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
  items: AdminGenerationItem[];
}

export interface AdminGenerationSummary {
  jobs: AdminGenerationJob[];
}
