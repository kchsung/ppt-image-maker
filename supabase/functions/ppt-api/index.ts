type ExternalAction =
  | 'analyze-request'
  | 'create-blueprint'
  | 'create-section-plan'
  | 'create-job'
  | 'save-pptx'
  | 'get-job';

type ExternalRequest = {
  action?: ExternalAction;
  request?: Record<string, unknown>;
  deckPlan?: Record<string, unknown>;
  jobId?: string;
  fileName?: string;
  pptxBase64?: string;
};

type GenerationJobRow = {
  id: string;
  status: 'pending' | 'processing' | 'succeeded' | 'failed';
  progress: number;
  total_items: number;
  completed_items: number;
  result_path: string | null;
  error_message: string | null;
  request: { deckPlan?: { title?: string } } | null;
  created_at: string | null;
  updated_at: string | null;
};

const MAX_PPTX_BASE64_BYTES = 25 * 1024 * 1024;
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-ppt-api-key',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }
  if (req.method !== 'POST') {
    return json({ error: 'Method not allowed.' }, 405);
  }

  try {
    assertAuthorized(req);
    const body = (await req.json()) as ExternalRequest;
    const action = body.action;

    switch (action) {
      case 'analyze-request':
        assertObject(body.request, 'request');
        return forwardFunction('analyze-ppt-request', { request: body.request });
      case 'create-blueprint':
        assertObject(body.request, 'request');
        return forwardFunction('generate-ppt-deck-blueprint', { request: body.request });
      case 'create-section-plan':
        assertObject(body.request, 'request');
        return forwardFunction('generate-ppt-slide-plan', { request: body.request });
      case 'create-job':
        assertObject(body.deckPlan, 'deckPlan');
        return forwardFunction('create-ppt-generation-job', { deckPlan: body.deckPlan, layoutOnly: true });
      case 'save-pptx':
        assertString(body.jobId, 'jobId');
        assertString(body.fileName, 'fileName');
        assertString(body.pptxBase64, 'pptxBase64');
        if (body.pptxBase64.length > MAX_PPTX_BASE64_BYTES) {
          return json({ error: 'pptxBase64 exceeds the 25 MiB API limit.' }, 413);
        }
        return forwardFunction('save-pptx-output', {
          jobId: body.jobId,
          fileName: body.fileName,
          pptxBase64: body.pptxBase64,
        });
      case 'get-job':
        assertString(body.jobId, 'jobId');
        return getJob(body.jobId);
      default:
        return json({ error: 'Unsupported action.' }, 400);
    }
  } catch (error) {
    const status = error instanceof ApiRequestError ? error.status : 500;
    return json({ error: error instanceof Error ? error.message : 'Unknown error.' }, status);
  }
});

async function forwardFunction(functionName: string, payload: Record<string, unknown>): Promise<Response> {
  const { supabaseUrl, serviceRoleKey } = getServerConfig();
  const response = await fetch(`${supabaseUrl}/functions/v1/${functionName}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${serviceRoleKey}`,
      apikey: serviceRoleKey,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });
  const raw = await response.text();
  const data = parseResponse(raw, response.status, functionName);
  return json(data, response.status);
}

async function getJob(jobId: string): Promise<Response> {
  const { supabaseUrl, serviceRoleKey } = getServerConfig();
  const response = await fetch(
    `${supabaseUrl}/rest/v1/generation_jobs?id=eq.${encodeURIComponent(jobId)}&select=id,status,progress,total_items,completed_items,result_path,error_message,request,created_at,updated_at`,
    {
      headers: {
        Authorization: `Bearer ${serviceRoleKey}`,
        apikey: serviceRoleKey,
      },
    },
  );
  const rows = parseResponse<GenerationJobRow[]>(await response.text(), response.status, 'generation_jobs');
  if (!response.ok) {
    return json(rows, response.status);
  }
  const job = rows[0];
  if (!job) {
    return json({ error: 'PPT generation job was not found.' }, 404);
  }

  return json({
    id: job.id,
    title: job.request?.deckPlan?.title ?? 'Untitled deck',
    status: job.status,
    progress: job.progress,
    totalItems: job.total_items,
    completedItems: job.completed_items,
    pptxStatus: job.result_path ? 'succeeded' : job.status === 'failed' ? 'failed' : 'not-started',
    pptxUrl: job.result_path ? `${supabaseUrl}/storage/v1/object/public/${job.result_path}` : null,
    resultPath: job.result_path,
    errorMessage: job.error_message,
    createdAt: job.created_at,
    updatedAt: job.updated_at,
  });
}

function assertAuthorized(req: Request): void {
  const expectedKey = Deno.env.get('PPT_EXTERNAL_API_KEY');
  if (!expectedKey) {
    throw new ApiRequestError('PPT_EXTERNAL_API_KEY is not configured.', 503);
  }
  const providedKey = req.headers.get('x-ppt-api-key') ?? getBearerToken(req.headers.get('authorization'));
  if (!providedKey || providedKey !== expectedKey) {
    throw new ApiRequestError('Invalid external PPT API key.', 401);
  }
}

function getBearerToken(authorization: string | null): string | null {
  if (!authorization?.startsWith('Bearer ')) {
    return null;
  }
  return authorization.slice('Bearer '.length).trim() || null;
}

function getServerConfig(): { supabaseUrl: string; serviceRoleKey: string } {
  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required.');
  }
  return { supabaseUrl, serviceRoleKey };
}

function parseResponse<T = unknown>(raw: string, status: number, source: string): T {
  try {
    return JSON.parse(raw) as T;
  } catch {
    const preview = raw.replace(/\s+/g, ' ').slice(0, 160);
    throw new ApiRequestError(`${source} returned a non-JSON response (${status}): ${preview || 'empty response'}`, 502);
  }
}

function assertObject(value: unknown, field: string): asserts value is Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new ApiRequestError(`${field} is required.`, 400);
  }
}

function assertString(value: unknown, field: string): asserts value is string {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new ApiRequestError(`${field} is required.`, 400);
  }
}

class ApiRequestError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
  }
}

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}
