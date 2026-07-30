import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

type Handler = (request: Request) => Promise<Response>;
let handler: Handler | null = null;
const fetchMock = vi.fn();

const request = {
  request: {
    sourceText: 'Teams need a reliable way to turn company documents into governed AI-ready knowledge.',
    targetLanguage: 'English',
    audience: 'Executive sponsors',
    purpose: 'Investment decision',
    slideCount: 20,
    coreMessage: 'A governed knowledge foundation makes AI adoption more useful and accountable.',
    styleReference: { name: 'QLEARN', notes: 'Clean executive presentation', primaryColorLabel: 'navy', accentColorLabel: 'orange' },
  },
};

function strategy() {
  return {
    coreThesis: 'A governed knowledge foundation makes AI adoption more useful and accountable.',
    audienceNeed: 'Leaders need a practical path from scattered documents to trusted AI workflows.',
    desiredOutcome: 'Approve a phased knowledge operating model and pilot owner.',
    narrativeArc: [
      { phase: 'Context', purpose: 'Frame the cost of fragmented knowledge.', slideNumbers: [1, 2, 3] },
      { phase: 'Model', purpose: 'Explain the governed operating model.', slideNumbers: [4, 5, 6, 7, 8, 9, 10] },
      { phase: 'Action', purpose: 'Set the pilot decision and path to scale.', slideNumbers: [11, 12, 13, 14, 15, 16, 17, 18, 19, 20] },
    ],
  };
}

function validBlueprint() {
  return {
    title: 'Turn Company Knowledge Into Accountable AI Workflows',
    strategy: strategy(),
    sections: [
      { id: 'context-model', title: 'Why Knowledge Must Become Governed', purpose: 'Build the case for change.', keyMessage: 'AI value depends on trusted and usable knowledge.', slideStart: 1, slideCount: 10, visualFocus: ['hero-visual', 'before-after-mapping', 'hub-and-spoke'] },
      { id: 'implementation', title: 'How To Launch And Scale', purpose: 'Move from model to decision.', keyMessage: 'A focused pilot creates evidence for safe scale.', slideStart: 11, slideCount: 10, visualFocus: ['roadmap', 'metrics-dashboard', 'closing-commitment'] },
    ],
  };
}

function openAiResponse(blueprint: unknown) {
  return new Response(JSON.stringify({ output_text: JSON.stringify(blueprint) }), { status: 200, headers: { 'Content-Type': 'application/json' } });
}

async function loadHandler() {
  handler = null;
  vi.resetModules();
  vi.stubGlobal('fetch', fetchMock);
  vi.stubGlobal('Deno', {
    env: { get: (key: string) => key === 'OPENAI_API_KEY' ? 'test-key' : 'gpt-4o' },
    serve: (next: Handler) => { handler = next; },
  });
  await import('./index.ts');
  if (!handler) throw new Error('The Edge Function handler was not registered.');
}

describe('generate-ppt-deck-blueprint Edge Function', () => {
  beforeEach(async () => { fetchMock.mockReset(); await loadHandler(); });
  afterEach(() => vi.unstubAllGlobals());

  it('creates contiguous ten-slide-or-smaller sections before slide drafting', async () => {
    fetchMock.mockResolvedValue(openAiResponse(validBlueprint()));

    const result = await handler!(new Request('http://localhost', { method: 'POST', body: JSON.stringify(request) }));
    const body = await result.json();
    const sent = JSON.parse(fetchMock.mock.calls[0][1].body) as { input: Array<{ content: Array<{ text: string }> }> };
    const prompt = JSON.parse(sent.input[0].content[0].text) as Record<string, unknown>;

    expect(result.status).toBe(200);
    expect(body.sections).toHaveLength(2);
    expect(body.sections.map((section: { slideStart: number }) => section.slideStart)).toEqual([1, 11]);
    expect(body.sections.map((section: { slideCount: number }) => section.slideCount)).toEqual([10, 10]);
    expect(prompt.maximumSlidesPerSection).toBe(10);
    expect(prompt.minimumSectionCount).toBe(2);
    expect(body.qaChecks[0]).toContain('2 coherent sections');
  });

  it('repairs a blueprint when one section exceeds the section batch limit', async () => {
    const invalid = validBlueprint();
    invalid.sections = [{ ...invalid.sections[0], slideCount: 20 }];
    fetchMock.mockResolvedValueOnce(openAiResponse(invalid)).mockResolvedValueOnce(openAiResponse(validBlueprint()));

    const result = await handler!(new Request('http://localhost', { method: 'POST', body: JSON.stringify(request) }));

    expect(result.status).toBe(200);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('supplies a safe visual direction when a model omits a section visual focus', async () => {
    const missingVisualFocus = validBlueprint();
    missingVisualFocus.sections[0].visualFocus = [];
    fetchMock.mockResolvedValue(openAiResponse(missingVisualFocus));

    const result = await handler!(new Request('http://localhost', { method: 'POST', body: JSON.stringify(request) }));
    const body = await result.json();

    expect(result.status).toBe(200);
    expect(body.sections[0].visualFocus).toEqual(['hero-visual', 'message-emphasis', 'card-grid']);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
