import { createClient, type SupabaseClient } from 'npm:@supabase/supabase-js@2';

type DeckPlan = {
  id: string;
  title: string;
  request: Record<string, unknown>;
  slides: unknown[];
};

type SlideImage = {
  id: string;
  pageNumber: number;
  imageDataUrl?: string;
  imageUrl?: string;
};

type RequestBody = {
  deckPlan?: DeckPlan;
  imageDeck?: { generationJobId?: string; images?: SlideImage[] };
};

type PptxGenerationStatus = 'processing' | 'succeeded' | 'failed';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  try {
    const body = await req.json() as RequestBody;
    if (!body.deckPlan || !body.imageDeck?.images?.length) {
      return json({ error: 'deckPlan and generated slide images are required.' }, 400);
    }

    const jobId = body.imageDeck.generationJobId;
    if (!jobId) return json({ error: 'A Supabase generation job is required to save the final PPTX.' }, 400);

    const workerUrl = Deno.env.get('NETLIFY_PPT_WORKER_URL');
    const workerSecret = Deno.env.get('PPT_WORKER_SECRET');
    if (!workerUrl || !workerSecret) {
      return json({ error: 'NETLIFY_PPT_WORKER_URL and PPT_WORKER_SECRET must be configured before generating a PPTX.' }, 503);
    }

    const supabase = createAdminClient();
    const executionId = crypto.randomUUID();
    await updatePptxGenerationStatus(supabase, jobId, {
      status: 'processing',
      errorMessage: null,
      progress: 5,
      phase: 'Queued for Netlify PPTX worker',
      executor: 'netlify-worker',
      executionId,
    });
    logPptxEvent('pptx.worker_dispatch_requested', { jobId, executionId, slideCount: body.imageDeck.images.length });

    const workerResponse = await fetch(workerUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Ppt-Worker-Secret': workerSecret,
      },
      body: JSON.stringify({ ...body, executionId }),
      signal: AbortSignal.timeout(10_000),
    });
    if (!workerResponse.ok) {
      const message = `Netlify PPTX worker could not accept the job (${workerResponse.status}).`;
      await updatePptxGenerationStatus(supabase, jobId, {
        status: 'failed',
        errorMessage: message,
        progress: 0,
        phase: 'PPTX worker dispatch failed',
        executor: 'netlify-worker',
        executionId,
      });
      return json({ error: message }, 502);
    }
    logPptxEvent('pptx.worker_dispatch_accepted', { jobId, executionId, status: workerResponse.status });

    return json({
      title: body.deckPlan.title,
      fileName: createFileName(body.deckPlan.title),
      generationMode: 'claude-native-pending',
      pptxStatus: 'processing',
      pptxExecutor: 'netlify-worker',
      pptxExecutionId: executionId,
      speakerNotes: [],
      qaChecklist: ['Netlify is creating the native editable PPTX in the background.'],
      layouts: [],
      layoutSource: 'claude',
    }, 202);
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : 'Netlify PPTX worker dispatch failed.' }, 500);
  }
});

async function updatePptxGenerationStatus(
  supabase: SupabaseClient,
  jobId: string,
  generation: {
    status: PptxGenerationStatus;
    errorMessage: string | null;
    progress: number;
    phase: string;
    executor: 'netlify-worker';
    executionId: string;
  },
): Promise<void> {
  const { data: job, error: readError } = await supabase
    .from('generation_jobs')
    .select('request')
    .eq('id', jobId)
    .single();
  if (readError) throw readError;

  const request = isRecord(job?.request) ? job.request : {};
  const { error: updateError } = await supabase
    .from('generation_jobs')
    .update({
      request: {
        ...request,
        pptxGeneration: { ...generation, updatedAt: new Date().toISOString() },
      },
      updated_at: new Date().toISOString(),
    })
    .eq('id', jobId);
  if (updateError) throw updateError;
}

function createAdminClient(): SupabaseClient {
  const url = Deno.env.get('SUPABASE_URL');
  const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!url || !key) throw new Error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required.');
  return createClient(url, key);
}

function createFileName(title: string): string {
  const cleaned = title.replace(/[\\/:*?"<>|]+/g, '-').replace(/\s+/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');
  return `${cleaned || 'qlearn-editable-deck'}.pptx`;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function logPptxEvent(event: string, details: Record<string, string | number>): void {
  console.info(JSON.stringify({ event, ...details }));
}

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
}
