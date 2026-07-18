import { describe, expect, it } from 'vitest';
import { isPptxGenerationInProgress, isPptxGenerationStale, PPTX_STALE_TIMEOUT_MS } from '@/utils/pptxGeneration';

const now = Date.parse('2026-07-19T00:00:00.000Z');

describe('pptx generation status helpers', () => {
  it('marks a processing PPTX job stale after the worker timeout window', () => {
    const job = {
      id: 'job-1',
      pptxStatus: 'processing' as const,
      pptxUpdatedAt: new Date(now - PPTX_STALE_TIMEOUT_MS - 1).toISOString(),
      updatedAt: new Date(now - PPTX_STALE_TIMEOUT_MS - 1).toISOString(),
    };

    expect(isPptxGenerationStale(job, now)).toBe(true);
    expect(isPptxGenerationInProgress(job, null, now)).toBe(false);
  });

  it('keeps recently updated jobs disabled while the worker is active', () => {
    const job = {
      id: 'job-1',
      pptxStatus: 'processing' as const,
      pptxUpdatedAt: new Date(now - 60_000).toISOString(),
      updatedAt: new Date(now - 60_000).toISOString(),
    };

    expect(isPptxGenerationStale(job, now)).toBe(false);
    expect(isPptxGenerationInProgress(job, null, now)).toBe(true);
  });
});
