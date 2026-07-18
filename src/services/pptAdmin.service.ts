import type { PptAdminService } from '@/interfaces/pptAdmin.interface';
import { supabase } from '@/lib/supabase';
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
  return {
    jobs: [
      {
        id: 'mock-job-1',
        title: 'AI Lecture Deck',
        status: 'succeeded',
        progress: 100,
        totalItems: 3,
        completedItems: 3,
        createdAt: now,
        updatedAt: now,
        errorMessage: null,
        deckPlan: {
          id: 'mock-deck-plan-1',
          title: 'AI Lecture Deck',
          createdAt: now,
          request: {
            sourceText: 'Mock source text',
            targetLanguage: 'English',
            audience: 'Executives',
            purpose: 'Lecture',
            slideCount: 3,
            styleReference: {
              id: 'mock-style',
              name: 'Mock style',
              notes: 'Mock style notes',
              primaryColorLabel: 'Navy',
              accentColorLabel: 'Orange',
            },
          },
          slides: [],
          copyQa: {
            status: 'passed',
            checks: ['Mock copy plan passed quality validation.'],
            issues: [],
          },
        },
        resultPath: null,
        pptxUrl: null,
        items: [
          {
            id: 'mock-item-1',
            pageNumber: 1,
            status: 'succeeded',
            outputPath: 'ppt-generations/mock-job-1/slide-01.png',
            imageUrl: null,
            errorMessage: null,
            updatedAt: now,
          },
        ],
      },
    ],
  };
}
