import { afterEach, describe, expect, it, vi } from 'vitest';

type Handler = (request: Request) => Promise<Response>;

const env = new Map<string, string>([
  ['PPT_EXTERNAL_API_KEY', 'external-test-key'],
  ['SUPABASE_URL', 'https://project.supabase.co'],
  ['SUPABASE_SERVICE_ROLE_KEY', 'service-role-key'],
]);
let handler: Handler | undefined;

vi.stubGlobal('Deno', {
  env: { get: (key: string) => env.get(key) },
  serve: (nextHandler: Handler) => {
    handler = nextHandler;
  },
});

await import('./index.ts');

afterEach(() => {
  vi.restoreAllMocks();
});

function request(body: Record<string, unknown>, apiKey = 'external-test-key'): Request {
  return new Request('https://project.supabase.co/functions/v1/ppt-api', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-ppt-api-key': apiKey },
    body: JSON.stringify(body),
  });
}

describe('ppt-api edge function', () => {
  it('rejects requests without an external API key', async () => {
    const response = await handler!(request({ action: 'get-job', jobId: 'job-1' }, ''));
    expect(response.status).toBe(401);
  });

  it('forwards a blueprint request through the internal Edge Function', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ title: 'Blueprint', sections: [] }), { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);

    const response = await handler!(request({ action: 'create-blueprint', request: { sourceText: 'Source' } }));

    expect(response.status).toBe(200);
    expect(fetchMock).toHaveBeenCalledWith(
      'https://project.supabase.co/functions/v1/generate-ppt-deck-blueprint',
      expect.objectContaining({
        headers: expect.objectContaining({ Authorization: 'Bearer service-role-key' }),
        body: JSON.stringify({ request: { sourceText: 'Source' } }),
      }),
    );
  });

  it('maps a saved job to a downloadable public PPTX URL', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify([{
      id: 'job-1', status: 'succeeded', progress: 100, total_items: 0, completed_items: 0,
      result_path: 'ppt-generations/job-1/final/deck.pptx', error_message: null,
      request: { deckPlan: { title: 'External deck' } }, created_at: '2026-01-01', updated_at: '2026-01-02',
    }]), { status: 200 })));

    const response = await handler!(request({ action: 'get-job', jobId: 'job-1' }));
    const body = await response.json();

    expect(body).toMatchObject({
      id: 'job-1',
      pptxStatus: 'succeeded',
      pptxUrl: 'https://project.supabase.co/storage/v1/object/public/ppt-generations/job-1/final/deck.pptx',
    });
  });

  it('rejects oversized uploads before sending a request to Storage', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    const response = await handler!(request({
      action: 'save-pptx', jobId: 'job-1', fileName: 'deck.pptx', pptxBase64: 'a'.repeat(25 * 1024 * 1024 + 1),
    }));

    expect(response.status).toBe(413);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
