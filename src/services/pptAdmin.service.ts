import type { PptAdminService } from '@/interfaces/pptAdmin.interface';
import { supabase } from '@/lib/supabase';
import type { AdminGenerationSummary } from '@/types/models/pptAdmin.model';
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
};

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
