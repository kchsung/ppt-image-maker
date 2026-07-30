import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

type Handler = (request: Request) => Promise<Response>;
let handler: Handler | null = null;
const fetchMock = vi.fn();

const requestBody = {
  request: {
    sourceText: 'A short source that needs a practical presentation.', targetLanguage: 'English', audience: 'Team leads', purpose: 'Strategy review', slideCount: 1,
    styleReference: { name: 'QLEARN', notes: 'Clean white and navy presentation', primaryColorLabel: 'navy', accentColorLabel: 'orange' },
  },
};

function response(slides: unknown[]) {
  return new Response(JSON.stringify({ output_text: JSON.stringify({ slides }) }), { status: 200, headers: { 'Content-Type': 'application/json' } });
}

function validSlide(overrides: Record<string, unknown> = {}) {
  return {
    pageNumber: 1, archetype: 'cover', visualStructure: 'hero-visual', title: 'Build Trust With Evidence',
    subtitle: 'A practical workflow for accountable AI decisions.',
    mainMessage: 'Teams move faster when generated work is linked to evidence and reviewed by accountable people.',
    labels: ['Set intent', 'Verify evidence', 'Approve action'], takeaway: 'Use AI to accelerate work while people own the decision.',
    imageSlot: { id: 'visual-1', purpose: 'Show connected evidence and accountable review.', placement: 'right-hero', prompt: 'Text-free editorial illustration of connected documents, a shield, and review signals.' },
    ...overrides,
  };
}

async function loadHandler() {
  handler = null;
  vi.resetModules();
  vi.stubGlobal('fetch', fetchMock);
  vi.stubGlobal('Deno', { env: { get: (key: string) => key === 'OPENAI_API_KEY' ? 'test-key' : 'gpt-4o' }, serve: (next: Handler) => { handler = next; } });
  await import('./index.ts');
  if (!handler) throw new Error('The Edge Function handler was not registered.');
}

describe('generate-ppt-slide-plan Edge Function', () => {
  beforeEach(async () => { fetchMock.mockReset(); await loadHandler(); });
  afterEach(() => vi.unstubAllGlobals());

  it('creates an OpenAI slide draft with an explicit image slot', async () => {
    fetchMock.mockResolvedValue(response([validSlide()]));
    const result = await handler!(new Request('http://localhost', { method: 'POST', body: JSON.stringify(requestBody) }));
    const body = await result.json();
    expect(result.status).toBe(200);
    expect(body.slides[0].imageSlot.placement).toBe('right-hero');
    expect(body.slides[0].imagePrompt).toContain('Text-free editorial illustration');
    expect(body.copyQa.status).toBe('passed');
  });

  it('repairs a plan that fails language QA', async () => {
    fetchMock.mockResolvedValueOnce(response([validSlide({ mainMessage: '한글 문구가 포함되었습니다.' })]))
      .mockResolvedValueOnce(response([validSlide()]));
    const result = await handler!(new Request('http://localhost', { method: 'POST', body: JSON.stringify(requestBody) }));
    expect(result.status).toBe(200);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('rejects an image prompt that asks OpenAI to render slide text', async () => {
    fetchMock.mockResolvedValueOnce(response([validSlide({ imageSlot: { id: 'visual-1', purpose: 'Bad', placement: 'right-hero', prompt: 'Render the title and labels on a full slide.' } })]))
      .mockResolvedValueOnce(response([validSlide({ imageSlot: { id: 'visual-1', purpose: 'Bad', placement: 'right-hero', prompt: 'Render the title and labels on a full slide.' } })]));
    const result = await handler!(new Request('http://localhost', { method: 'POST', body: JSON.stringify(requestBody) }));
    expect(result.status).toBe(422);
    expect((await result.json()).error).toContain('text-free visual asset');
  });
});
