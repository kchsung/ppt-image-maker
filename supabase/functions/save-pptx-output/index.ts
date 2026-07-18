import { createClient, type SupabaseClient } from 'npm:@supabase/supabase-js@2';

type SavePptxBody = {
  jobId?: string;
  fileName?: string;
  pptxBase64?: string;
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
    const body = (await req.json()) as SavePptxBody;
    if (!body.jobId || !body.fileName || !body.pptxBase64) {
      return json({ error: 'jobId, fileName, and pptxBase64 are required.' }, 400);
    }

    const supabase = createAdminClient();
    const fileName = sanitizeFileName(body.fileName);
    const storagePath = `${body.jobId}/final/${fileName}`;
    const bytes = base64ToBytes(body.pptxBase64);

    const { error: uploadError } = await supabase.storage.from('ppt-generations').upload(storagePath, bytes, {
      contentType: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      upsert: true,
    });

    if (uploadError) {
      throw uploadError;
    }

    const resultPath = `ppt-generations/${storagePath}`;
    const { error: updateError } = await supabase
      .from('generation_jobs')
      .update({
        result_path: resultPath,
        updated_at: new Date().toISOString(),
      })
      .eq('id', body.jobId);

    if (updateError) {
      throw updateError;
    }

    const { data } = supabase.storage.from('ppt-generations').getPublicUrl(storagePath);
    return json({ resultPath, pptxUrl: data.publicUrl });
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

function sanitizeFileName(fileName: string): string {
  const cleaned = fileName
    .replace(/[\\/:*?"<>|]+/g, '-')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');

  return cleaned.toLowerCase().endsWith('.pptx') ? cleaned : `${cleaned || 'qlearn-deck'}.pptx`;
}

function base64ToBytes(b64: string): Uint8Array {
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }

  return bytes;
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
