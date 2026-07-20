import type { PptAdminService } from '@/interfaces/pptAdmin.interface';
import { supabase } from '@/lib/supabase';
import { createMockDeckPlan, createMockSlideImageDataUrl, samplePptMakerRequest } from '@/mocks/pptMaker.mock';
import type { AdminGenerationSummary, SavedPptxOutput } from '@/types/models/pptAdmin.model';
import { getSupabaseFunctionErrorMessage } from '@/utils/supabaseFunctionError';

export const pptAdminService: PptAdminService = {
  async listGenerationJobs() {
    if (!supabase) {
      return createMockSummary();
    }

    const { data, error } = await supabase.functions.invoke<AdminGenerationSummary>('list-ppt-generation-jobs', {
      body: {},
    });

    if (error) {
      throw new Error(`Failed to load generation jobs: ${await getSupabaseFunctionErrorMessage(error)}`);
    }

    return data ?? { jobs: [] };
  },

  async deleteGenerationJob(jobId) {
    if (!supabase) {
      return;
    }

    const { error } = await supabase.functions.invoke('delete-ppt-generation-job', {
      body: { jobId },
    });

    if (error) {
      throw new Error(`Failed to delete generation job: ${await getSupabaseFunctionErrorMessage(error)}`);
    }
  },

  async retryGenerationItem(jobId, itemId) {
    if (!supabase) {
      return;
    }

    for (let attempt = 0; attempt < 3; attempt += 1) {
      const { error } = await supabase.functions.invoke('generate-ppt-image-deck', {
        body: { jobId, itemId },
      });
      if (!error) return;

      const message = await getSupabaseFunctionErrorMessage(error);
      const retryAfterSeconds = getImageRetryAfterSeconds(message);
      if (retryAfterSeconds && attempt < 2) {
        await wait(retryAfterSeconds * 1_000);
        continue;
      }
      throw new Error(`Failed to retry generation item: ${message}`);
    }
  },

  async savePptxOutput(jobId, fileName, pptxBlob) {
    if (!supabase) {
      return null;
    }

    const { data, error } = await supabase.functions.invoke<SavedPptxOutput>('save-pptx-output', {
      body: {
        jobId,
        fileName,
        pptxBase64: await blobToBase64(pptxBlob),
      },
    });

    if (error) {
      throw new Error(`Failed to save PPTX output: ${await getSupabaseFunctionErrorMessage(error)}`);
    }

    return data ?? null;
  },
};

function getImageRetryAfterSeconds(message: string): number | null {
  const match = message.match(/retry after\s+(\d+)\s+seconds/iu) ?? message.match(/try again in\s+(\d+)s/iu);
  return match ? Math.max(1, Number(match[1])) : null;
}

function wait(durationMs: number): Promise<void> {
  return new Promise((resolve) => window.setTimeout(resolve, durationMs));
}

async function blobToBase64(blob: Blob): Promise<string> {
  const dataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Failed to read PPTX blob.'));
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        resolve(reader.result);
      } else {
        reject(new Error('PPTX blob conversion returned an invalid result.'));
      }
    };
    reader.readAsDataURL(blob);
  });

  return dataUrl.replace(/^data:.*?;base64,/, '');
}

function createMockSummary(): AdminGenerationSummary {
  const now = new Date().toISOString();
  const deckPlan = createMockDeckPlan({ ...samplePptMakerRequest, slideCount: 4 }, {
    id: 'mock-deck-plan-1',
    createdAt: now,
  });

  return {
    jobs: [
      {
        id: 'mock-job-1',
        title: deckPlan.title,
        status: 'succeeded',
        progress: 100,
        totalItems: deckPlan.slides.length,
        completedItems: deckPlan.slides.length,
        createdAt: now,
        updatedAt: now,
        errorMessage: null,
        deckPlan,
        resultPath: null,
        pptxUrl: null,
        pptxStatus: 'not-started',
        items: deckPlan.slides.map((slide) => ({
          id: `mock-item-${slide.pageNumber}`,
          pageNumber: slide.pageNumber,
          status: 'succeeded' as const,
          outputPath: `ppt-generations/mock-job-1/slides/slide-${String(slide.pageNumber).padStart(2, '0')}.png`,
          imageUrl: createMockSlideImageDataUrl(slide),
          errorMessage: null,
          updatedAt: now,
        })),
      },
    ],
  };
}
