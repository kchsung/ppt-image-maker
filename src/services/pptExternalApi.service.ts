import type {
  ExternalPptGenerationStatus,
  ExternalPptxSaveResult,
  PptExternalApiAction,
  PptExternalApiClient,
  PptExternalApiConfig,
} from '@/types/models/pptExternalApi.model';
import type {
  GenerationJob,
  PptDeckBlueprint,
  PptDeckPlan,
  PptMakerRequest,
  PptRequestAnalysis,
} from '@/types/models/pptMaker.model';

type ApiError = {
  error?: string;
};

export function createPptExternalApiClient(config: PptExternalApiConfig): PptExternalApiClient {
  const fetcher = config.fetcher ?? fetch;
  const endpoint = config.baseUrl.replace(/\/+$/, '');

  async function call<T>(action: PptExternalApiAction, payload: Record<string, unknown>): Promise<T> {
    const response = await fetcher(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-ppt-api-key': config.apiKey,
      },
      body: JSON.stringify({ action, ...payload }),
    });
    const raw = await response.text();
    const data = parseJson<ApiError & T>(raw, response.status);

    if (!response.ok) {
      throw new Error(data.error ?? `PPT API request failed with status ${response.status}.`);
    }
    return data;
  }

  return {
    analyzeRequest: (request) => call<PptRequestAnalysis>('analyze-request', { request }),
    createBlueprint: (request) => call<PptDeckBlueprint>('create-blueprint', { request }),
    createSectionPlan: (request) => call<PptDeckPlan>('create-section-plan', { request }),
    createJob: (deckPlan) => call<GenerationJob | null>('create-job', { deckPlan }),
    savePptx: (input) => call<ExternalPptxSaveResult>('save-pptx', input),
    getJob: (jobId) => call<ExternalPptGenerationStatus>('get-job', { jobId }),
  };
}

function parseJson<T>(raw: string, status: number): T {
  try {
    return JSON.parse(raw) as T;
  } catch {
    const preview = raw.replace(/\s+/g, ' ').slice(0, 160);
    throw new Error(`PPT API returned a non-JSON response (${status}): ${preview || 'empty response'}`);
  }
}
