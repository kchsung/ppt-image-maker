import { createClient, type SupabaseClient } from 'npm:@supabase/supabase-js@2';

type JobRow = {
  id: string;
  status: 'pending' | 'processing' | 'succeeded' | 'failed';
  progress: number;
  total_items: number;
  completed_items: number;
  request: {
    deckPlan?: {
      title?: string;
    };
  };
  error_message: string | null;
  created_at: string;
  updated_at: string;
};

type ItemRow = {
  id: string;
  job_id: string;
  item_index: number;
  status: 'pending' | 'processing' | 'succeeded' | 'failed';
  output_path: string | null;
  error_message: string | null;
  updated_at: string;
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
    const supabase = createAdminClient();
    const { data: jobs, error: jobsError } = await supabase
      .from('generation_jobs')
      .select('id,status,progress,total_items,completed_items,request,error_message,created_at,updated_at')
      .eq('type', 'ppt_image_deck')
      .order('created_at', { ascending: false })
      .limit(50);

    if (jobsError) {
      throw jobsError;
    }

    const jobRows = (jobs ?? []) as JobRow[];
    const jobIds = jobRows.map((job) => job.id);
    const itemsByJob = new Map<string, ItemRow[]>();

    if (jobIds.length > 0) {
      const { data: items, error: itemsError } = await supabase
        .from('generation_items')
        .select('id,job_id,item_index,status,output_path,error_message,updated_at')
        .in('job_id', jobIds)
        .order('item_index', { ascending: true });

      if (itemsError) {
        throw itemsError;
      }

      ((items ?? []) as ItemRow[]).forEach((item) => {
        const current = itemsByJob.get(item.job_id) ?? [];
        current.push(item);
        itemsByJob.set(item.job_id, current);
      });
    }

    return json({
      jobs: jobRows.map((job) => ({
        id: job.id,
        title: job.request?.deckPlan?.title ?? 'Untitled Deck',
        status: job.status,
        progress: job.progress,
        totalItems: job.total_items,
        completedItems: job.completed_items,
        createdAt: job.created_at,
        updatedAt: job.updated_at,
        errorMessage: job.error_message,
        items: (itemsByJob.get(job.id) ?? []).map((item) => ({
          id: item.id,
          pageNumber: item.item_index,
          status: item.status,
          outputPath: item.output_path,
          imageUrl: getPublicImageUrl(supabase, item.output_path),
          errorMessage: item.error_message,
          updatedAt: item.updated_at,
        })),
      })),
    });
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : 'Unknown error' }, 500);
  }
});

function createAdminClient(): SupabaseClient {
  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required.');
  }

  return createClient(supabaseUrl, serviceRoleKey);
}

function getPublicImageUrl(supabase: SupabaseClient, outputPath: string | null): string | null {
  const storagePath = toStoragePath(outputPath);
  if (!storagePath) {
    return null;
  }

  const { data } = supabase.storage.from('ppt-generations').getPublicUrl(storagePath);
  return data.publicUrl;
}

function toStoragePath(outputPath: string | null): string | null {
  if (!outputPath) {
    return null;
  }

  return outputPath.startsWith('ppt-generations/') ? outputPath.replace('ppt-generations/', '') : outputPath;
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
