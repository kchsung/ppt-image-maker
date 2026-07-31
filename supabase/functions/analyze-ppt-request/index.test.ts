import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

type Handler = (request: Request) => Promise<Response>;
let handler: Handler | null = null;
const fetchMock = vi.fn();

async function loadHandler() {
  handler = null;
  vi.resetModules();
  vi.stubGlobal('fetch', fetchMock);
  vi.stubGlobal('Deno', {
    env: { get: (key: string) => key === 'OPENAI_API_KEY' ? 'test-key' : undefined },
    serve: (next: Handler) => { handler = next; },
  });
  await import('./index.ts');
  if (!handler) throw new Error('The Edge Function handler was not registered.');
}

describe('analyze-ppt-request Edge Function', () => {
  beforeEach(async () => { fetchMock.mockReset(); await loadHandler(); });
  afterEach(() => vi.unstubAllGlobals());

  it('returns complete production conditions extracted by the planning model', async () => {
    fetchMock.mockResolvedValue(new Response(JSON.stringify({ output_text: JSON.stringify({
      topic: 'Trusted AI Knowledge Foundation', purpose: 'Approve a governed AI pilot', audience: 'Executive sponsors',
      presentationDurationMinutes: 30, slideCount: 17, documentType: 'proposal', presentationIntent: 'executive-proposal',
      contentDensity: 'standard', coreMessage: 'Trusted knowledge makes AI adoption accountable.',
      requiredSections: 'Challenge, model, proof, rollout, decision', rationale: ['The source is a decision proposal.', 'Thirty minutes supports seventeen standard-detail slides.'],
      sourceMaterialAnalysis: { summary: 'The source supports a governed pilot.', keyPoints: ['Governed pilot'], dataPoints: [], availableVisuals: [] },
      clarifyingQuestions: [],
    }) }), { status: 200 }));

    const result = await handler!(new Request('http://localhost', { method: 'POST', body: JSON.stringify({ request: {
      sourceText: 'Executive sponsors need a governed AI knowledge pilot. Presentation duration: 30 minutes.', targetLanguage: 'English', slideCount: 12,
    } }) }));
    const body = await result.json();

    expect(result.status).toBe(200);
    expect(body.slideCount).toBe(17);
    expect(body.presentationDurationMinutes).toBe(30);
    expect(body.documentType).toBe('proposal');
  });

  it('reads structured analysis text from a nested Responses API content value', async () => {
    const analysis = {
      topic: 'Trusted AI Knowledge Foundation', purpose: 'Approve a governed AI pilot', audience: 'Executive sponsors',
      presentationDurationMinutes: 30, slideCount: 17, documentType: 'proposal', presentationIntent: 'executive-proposal',
      contentDensity: 'standard', coreMessage: 'Trusted knowledge makes AI adoption accountable.',
      requiredSections: 'Challenge, model, proof, rollout, decision', rationale: ['The source is a decision proposal.', 'Thirty minutes supports seventeen standard-detail slides.'],
      sourceMaterialAnalysis: { summary: 'The source supports a governed pilot.', keyPoints: ['Governed pilot'], dataPoints: [], availableVisuals: [] },
      clarifyingQuestions: [],
    };
    fetchMock.mockResolvedValue(new Response(JSON.stringify({
      output: [{ type: 'message', content: [{ type: 'output_text', text: { value: JSON.stringify(analysis) } }] }],
    }), { status: 200 }));

    const result = await handler!(new Request('http://localhost', { method: 'POST', body: JSON.stringify({ request: {
      sourceText: 'Executive sponsors need a governed AI knowledge pilot.', targetLanguage: 'English', slideCount: 12,
    } }) }));
    const body = await result.json();

    expect(result.status).toBe(200);
    expect(body.topic).toBe('Trusted AI Knowledge Foundation');
    const requestBody = JSON.parse(fetchMock.mock.calls[0][1].body) as { model: string; reasoning: { effort: string }; max_output_tokens: number };
    expect(requestBody.model).toBe('gpt-5');
    expect(requestBody.reasoning).toEqual({ effort: 'low' });
    expect(requestBody.max_output_tokens).toBe(5000);
  });

  it('adds a required duration selection when the model cannot identify a presentation length', async () => {
    fetchMock.mockResolvedValue(new Response(JSON.stringify({ output_text: JSON.stringify({
      topic: 'Trusted AI Knowledge Foundation', purpose: 'Approve a governed AI pilot', audience: 'Executive sponsors',
      presentationDurationMinutes: null, slideCount: 12, documentType: 'proposal', presentationIntent: 'executive-proposal',
      contentDensity: 'standard', coreMessage: 'Trusted knowledge makes AI adoption accountable.',
      requiredSections: 'Challenge, model, proof, rollout, decision', rationale: ['The source is a decision proposal.', 'No duration was stated in the source.'],
      sourceMaterialAnalysis: { summary: 'The source supports a governed pilot.', keyPoints: ['Governed pilot'], dataPoints: [], availableVisuals: [] },
      clarifyingQuestions: [],
    }) }), { status: 200 }));

    const result = await handler!(new Request('http://localhost', { method: 'POST', body: JSON.stringify({ request: {
      sourceText: 'Executive sponsors need a governed AI knowledge pilot.', targetLanguage: 'English', slideCount: 12,
    } }) }));
    const body = await result.json();

    expect(result.status).toBe(200);
    expect(body.clarifyingQuestions).toContainEqual(expect.objectContaining({ field: 'presentationDurationMinutes', required: true }));
  });

  it('passes image attachments to the planning model and returns extracted material analysis', async () => {
    fetchMock.mockResolvedValue(new Response(JSON.stringify({ output_text: JSON.stringify({
      topic: 'Trusted AI Knowledge Foundation', purpose: 'Approve a governed AI pilot', audience: 'Executive sponsors',
      presentationDurationMinutes: 20, slideCount: 12, documentType: 'proposal', presentationIntent: 'executive-proposal',
      contentDensity: 'standard', coreMessage: 'Trusted knowledge makes AI adoption accountable.',
      requiredSections: 'Challenge, model, proof, rollout, decision', rationale: ['The source includes a visual architecture.', 'Twenty minutes supports twelve slides.'],
      sourceMaterialAnalysis: {
        summary: 'The attached architecture visual shows a governed knowledge flow.',
        keyPoints: ['The flow connects source systems and AI use.'], dataPoints: [], availableVisuals: ['Architecture reference'],
      },
      clarifyingQuestions: [],
    }) }), { status: 200 }));

    const result = await handler!(new Request('http://localhost', { method: 'POST', body: JSON.stringify({ request: {
      sourceText: 'Use the attached architecture visual as source evidence.', targetLanguage: 'English', slideCount: 12,
      sourceAttachments: [{
        id: 'architecture', name: 'architecture.png', type: 'image', extractedCharacterCount: 0, tableCount: 0, imageCount: 1,
        imageDataUrl: 'data:image/png;base64,aW1hZ2U=',
      }],
    } }) }));
    const body = await result.json();
    const requestBody = JSON.parse(fetchMock.mock.calls[0][1].body) as { input: Array<{ content: Array<{ type: string; image_url?: string }> }> };

    expect(result.status).toBe(200);
    expect(requestBody.input[0].content).toContainEqual({ type: 'input_image', image_url: 'data:image/png;base64,aW1hZ2U=' });
    expect(body.sourceMaterialAnalysis.availableVisuals).toContain('Architecture reference');
  });

  it('keeps a selected purpose template as the controlling production contract', async () => {
    fetchMock.mockResolvedValue(new Response(JSON.stringify({ output_text: JSON.stringify({
      topic: 'AI Knowledge Foundation', purpose: 'Approve an investment', audience: 'Investors',
      presentationDurationMinutes: 20, slideCount: 12, documentType: 'proposal', presentationIntent: 'executive-proposal',
      contentDensity: 'standard', coreMessage: 'Governed knowledge creates an investable AI capability.',
      requiredSections: 'Market proof, product evidence', rationale: ['The deck needs investor evidence.', 'Twenty minutes supports twelve slides.'],
      sourceMaterialAnalysis: { summary: 'The source supports an AI knowledge platform.', keyPoints: ['Governed evidence'], dataPoints: [], availableVisuals: [] },
      clarifyingQuestions: [],
    }) }), { status: 200 }));

    const result = await handler!(new Request('http://localhost', { method: 'POST', body: JSON.stringify({ request: {
      sourceText: 'A governed knowledge platform needs investment to scale.', targetLanguage: 'English', slideCount: 12,
      purposeTemplate: {
        id: 'ir', name: 'IR / Investment Deck', description: 'Investor narrative.', documentType: 'investment', presentationIntent: 'investment-deck',
        defaultOutline: ['Investment thesis', 'Market and problem', 'Investment ask'], compositionRules: ['State the ask clearly.'],
      },
    } }) }));
    const body = await result.json();
    const payload = JSON.parse(fetchMock.mock.calls[0][1].body) as { input: Array<{ content: Array<{ text: string }> }> };
    const prompt = JSON.parse(payload.input[0].content[0].text) as { currentConditions: { purposeTemplate: { id: string } } };

    expect(result.status).toBe(200);
    expect(prompt.currentConditions.purposeTemplate.id).toBe('ir');
    expect(body.documentType).toBe('investment');
    expect(body.presentationIntent).toBe('investment-deck');
    expect(body.requiredSections).toContain('Investment thesis');
  });
});
