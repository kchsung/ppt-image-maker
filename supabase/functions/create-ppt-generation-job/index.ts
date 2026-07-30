import { createClient } from 'npm:@supabase/supabase-js@2';

type SlidePlan = {
  id: string;
  pageNumber: number;
  title: string;
};

type PptDeckPlan = {
  id: string;
  title: string;
  slides: SlidePlan[];
};

type GenerationItemRow = {
  id: string;
  item_index: number;
  input: {
    slideId?: string;
    pageNumber?: number;
  } | null;
};

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return json({ error: 'Method not allowed' }, 405);
  }

  try {
    const body = (await req.json()) as { deckPlan?: PptDeckPlan; layoutOnly?: boolean };
    const deckPlan = body.deckPlan;

    if (!deckPlan || !Array.isArray(deckPlan.slides) || deckPlan.slides.length === 0) {
      return json({ error: 'deckPlan with slides is required.' }, 400);
    }

    const layoutOnly = body.layoutOnly === true;
    logJobEvent('job.create.requested', { deckPlanId: deckPlan.id, slideCount: deckPlan.slides.length, layoutOnly: String(layoutOnly) });

    const supabase = createAdminClient();
    const { data: job, error: jobError } = await supabase
      .from('generation_jobs')
      .insert({
        type: 'ppt_image_deck',
        status: layoutOnly ? 'succeeded' : 'pending',
        progress: layoutOnly ? 100 : 0,
        total_items: layoutOnly ? 0 : deckPlan.slides.length,
        completed_items: layoutOnly ? 0 : 0,
        request: { deckPlan, generationMode: layoutOnly ? 'layout-only' : 'legacy-image-deck' },
      })
      .select('id, status, total_items, completed_items')
      .single();

    if (jobError || !job) {
      throw jobError ?? new Error('Failed to create generation job.');
    }
    logJobEvent('job.create.persisted', { jobId: job.id, totalItems: job.total_items });

    if (layoutOnly) {
      return json(
        {
          id: job.id,
          status: job.status,
          totalItems: job.total_items,
          completedItems: job.completed_items,
          items: [],
        },
        201,
      );
    }

    const itemRows = deckPlan.slides.map((slide) => ({
      job_id: job.id,
      item_index: slide.pageNumber,
      item_type: 'slide_image',
      status: 'pending',
      input: {
        slideId: slide.id,
        pageNumber: slide.pageNumber,
        title: slide.title,
      },
    }));

    const { data: items, error: itemsError } = await supabase
      .from('generation_items')
      .insert(itemRows)
      .select('id, item_index, input')
      .order('item_index', { ascending: true });

    if (itemsError || !items) {
      throw itemsError ?? new Error('Failed to create generation job items.');
    }
    logJobEvent('job.create.ready', { jobId: job.id, itemCount: items.length });

    return json(
      {
        id: job.id,
        status: job.status,
        totalItems: job.total_items,
        completedItems: job.completed_items,
        items: (items as GenerationItemRow[]).map((item) => ({
          id: item.id,
          slideId: item.input?.slideId ?? `slide-${item.item_index}`,
          pageNumber: item.input?.pageNumber ?? item.item_index,
        })),
      },
      202,
    );
  } catch (error) {
    console.error(JSON.stringify({
      event: 'job.create.failed',
      error: error instanceof Error ? error.message : 'Unknown error',
    }));
    return json({ error: error instanceof Error ? error.message : 'Unknown error' }, 500);
  }
});

function logJobEvent(event: string, details: Record<string, string | number>): void {
  console.info(JSON.stringify({ event, ...details }));
}

function createAdminClient() {
  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required.');
  }

  return createClient(supabaseUrl, serviceRoleKey);
}

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      ...corsHeaders,
      'Content-Type': 'application/json',
    },
  });
}
