import type { AdminGenerationSummary, SavedPptxOutput } from '@/types/models/pptAdmin.model';

export interface PptAdminService {
  listGenerationJobs(): Promise<AdminGenerationSummary>;
  retryGenerationItem(jobId: string, itemId: string): Promise<void>;
  savePptxOutput(jobId: string, fileName: string, pptxBlob: Blob): Promise<SavedPptxOutput | null>;
  deleteGenerationJob(jobId: string): Promise<void>;
}
