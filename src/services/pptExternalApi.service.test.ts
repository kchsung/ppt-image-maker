import { describe, expect, it, vi } from 'vitest';

import { createPptExternalApiClient } from '@/services/pptExternalApi.service';

describe('createPptExternalApiClient', () => {
  it('sends the external API key and action payload', async () => {
    const fetcher = vi.fn().mockResolvedValue(new Response(JSON.stringify({ id: 'job-1', status: 'succeeded' }), { status: 200 }));
    const client = createPptExternalApiClient({
      baseUrl: 'https://example.supabase.co/functions/v1/ppt-api/',
      apiKey: 'external-secret',
      fetcher,
    });

    await client.getJob('job-1');

    expect(fetcher).toHaveBeenCalledWith(
      'https://example.supabase.co/functions/v1/ppt-api',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({ 'x-ppt-api-key': 'external-secret' }),
        body: JSON.stringify({ action: 'get-job', jobId: 'job-1' }),
      }),
    );
  });

  it('returns a useful error when an upstream proxy returns HTML', async () => {
    const client = createPptExternalApiClient({
      baseUrl: 'https://example.supabase.co/functions/v1/ppt-api',
      apiKey: 'external-secret',
      fetcher: vi.fn().mockResolvedValue(new Response('<!DOCTYPE html><h1>Bad gateway</h1>', { status: 502 })),
    });

    await expect(client.getJob('job-1')).rejects.toThrow('non-JSON response (502)');
  });
});
