import { createClient, type SupabaseClient } from 'npm:@supabase/supabase-js@2';

type DeleteBody = {
  jobId?: string;
};

type ItemRow = {
  output_path: string | null;
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
    const body = (await req.json()) as DeleteBody;
    if (!body.jobId) {
      return json({ error: 'jobId is required.' }, 400);
    }

    const supabase = createAdminClient();
    const { data: items, error: itemsError } = await supabase
      .from('generation_items')
      .select('output_path')
      .eq('job_id', body.jobId);

    if (itemsError) {
      throw itemsError;
    }

    const storagePaths = ((items ?? []) as ItemRow[])
      .map((item) => toStoragePath(item.output_path))
      .filter((path): path is string => Boolean(path));

    if (storagePaths.length > 0) {
      const { error: storageError } = await supabase.storage.from('ppt-generations').remove(storagePaths);
      if (storageError) {
        throw storageError;
      }
    }

    const { error: deleteError } = await supabase.from('generation_jobs').delete().eq('id', body.jobId);
    if (deleteError) {
      throw deleteError;
    }

    return json({ deleted: true, deletedFiles: storagePaths.length });
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
