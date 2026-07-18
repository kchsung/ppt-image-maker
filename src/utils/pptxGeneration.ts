import type { AdminGenerationJob } from '@/types/models/pptAdmin.model';

export const PPTX_STALE_TIMEOUT_MS = 20 * 60 * 1000;

export function isPptxGenerationStale(
  job: Pick<AdminGenerationJob, 'pptxStatus' | 'pptxUpdatedAt' | 'updatedAt'>,
  now = Date.now(),
): boolean {
  if (job.pptxStatus !== 'processing') {
    return false;
  }

  const updatedAt = Date.parse(job.pptxUpdatedAt ?? job.updatedAt);
  return Number.isFinite(updatedAt) && now - updatedAt > PPTX_STALE_TIMEOUT_MS;
}

export function isPptxGenerationInProgress(
  job: Pick<AdminGenerationJob, 'id' | 'pptxStatus' | 'pptxUpdatedAt' | 'updatedAt'>,
  exportingJobId: string | null,
  now = Date.now(),
): boolean {
  return exportingJobId === job.id || (job.pptxStatus === 'processing' && !isPptxGenerationStale(job, now));
}
