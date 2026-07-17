import type { AdminGenerationSummary } from '@/types/models/pptAdmin.model';

export interface PptAdminService {
  listGenerationJobs(): Promise<AdminGenerationSummary>;
  deleteGenerationJob(jobId: string): Promise<void>;
}
