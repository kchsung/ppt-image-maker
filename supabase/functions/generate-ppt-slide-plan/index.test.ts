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

function response(slides: unknown[], strategy = validStrategy()) {
  return new Response(JSON.stringify({ output_text: JSON.stringify({ strategy, slides }) }), { status: 200, headers: { 'Content-Type': 'application/json' } });
}

function validStrategy() {
  return {
    coreThesis: 'Evidence-backed decisions help teams use AI with confidence.',
    audienceNeed: 'Team leads need a practical model for responsible AI adoption.',
    desiredOutcome: 'Agree the first workflow to standardize and its accountable owner.',
    narrativeArc: [
      { phase: 'Context', purpose: 'Frame the decision.', slideNumbers: [1] },
      { phase: 'Evidence', purpose: 'Build the case.', slideNumbers: [2] },
      { phase: 'Action', purpose: 'Confirm the next step.', slideNumbers: [3] },
    ],
  };
}

function validSlide(overrides: Record<string, unknown> = {}) {
  return {
    pageNumber: 1, archetype: 'cover', visualStructure: 'hero-visual', title: 'Build Trust With Evidence',
    subtitle: 'A practical workflow for accountable AI decisions.',
    objective: 'Show the decision framework the audience should adopt.',
    mainMessage: 'Teams move faster when generated work is linked to evidence and reviewed by accountable people.',
    labels: ['Set intent', 'Verify evidence', 'Approve action'], takeaway: 'Use AI to accelerate work while people own the decision.',
    contentBlocks: [
      { heading: 'Set intent', detail: 'State the decision, audience, and acceptable risk before a model creates a draft.' },
      { heading: 'Verify evidence', detail: 'Link material claims to sources and make uncertain assumptions visible to reviewers.' },
      { heading: 'Approve action', detail: 'Assign a named owner who confirms the final recommendation and next action.' },
    ],
    decision: 'Standardize one evidence-backed review workflow this quarter.',
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

  it('creates an OpenAI slide draft with strategy and supporting proof points', async () => {
    fetchMock.mockResolvedValue(response([validSlide()]));
    const result = await handler!(new Request('http://localhost', { method: 'POST', body: JSON.stringify(requestBody) }));
    const body = await result.json();
    expect(result.status).toBe(200);
    expect(body.strategy.coreThesis).toContain('Evidence-backed decisions');
    expect(body.slides[0].contentBlocks).toHaveLength(3);
    expect(body.slides[0].decision).toContain('Standardize');
    expect(body.slides[0].imagePrompt).toBe('');
    expect(body.copyQa.status).toBe('passed');
  });

  it('normalizes an older or partially completed form request instead of rejecting it', async () => {
    fetchMock.mockResolvedValue(response([validSlide()]));
    const result = await handler!(new Request('http://localhost', {
      method: 'POST',
      body: JSON.stringify({ request: { sourceText: 'A source remains sufficient when optional form fields are absent.', slideCount: 1 } }),
    }));
    const payload = JSON.parse(fetchMock.mock.calls[0][1].body) as { input: Array<{ content: Array<{ text: string }> }> };
    const planningPrompt = JSON.parse(payload.input[0].content[0].text) as Record<string, unknown>;

    expect(result.status).toBe(200);
    expect(planningPrompt.targetLanguage).toBe('English');
    expect(planningPrompt.audience).toBe('General audience');
    expect(planningPrompt.styleReference).toMatchObject({ name: 'QLEARN' });
  });

  it('retries when the upstream planner returns an HTML error page', async () => {
    fetchMock
      .mockResolvedValueOnce(new Response('<!DOCTYPE html><html><body>Temporary gateway error</body></html>', {
        status: 502,
        headers: { 'Content-Type': 'text/html' },
      }))
      .mockResolvedValueOnce(response([validSlide()]));

    const result = await handler!(new Request('http://localhost', { method: 'POST', body: JSON.stringify(requestBody) }));

    expect(result.status).toBe(200);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('turns the presentation brief into mandatory slide planning direction', async () => {
    const guidedRequest = {
      request: {
        ...requestBody.request,
        presentationIntent: 'executive-proposal',
        coreMessage: 'Convert verified enterprise knowledge into accountable AI assets.',
        requiredSections: 'Current challenge, knowledge operating model, rollout, decision request',
        presentationGuide: {
          name: 'B2B Executive Proposal',
          narrativeGuide: 'Decision context, proposed model, proof, rollout, and business outcome.',
          visualGuide: 'Quiet executive composition with a decision-oriented footer.',
          slideRules: ['Lead with the business decision, not product features.'],
        },
      },
    };
    fetchMock.mockResolvedValue(response([validSlide()]));

    const result = await handler!(new Request('http://localhost', { method: 'POST', body: JSON.stringify(guidedRequest) }));
    const payload = JSON.parse(fetchMock.mock.calls[0][1].body) as { input: Array<{ content: Array<{ text: string }> }> };
    const planningPrompt = JSON.parse(payload.input[0].content[0].text) as Record<string, unknown>;

    expect(result.status).toBe(200);
    expect(planningPrompt.coreMessage).toBe('Convert verified enterprise knowledge into accountable AI assets.');
    expect(planningPrompt.requiredSections).toContain('knowledge operating model');
    expect(planningPrompt.presentationGuide).toMatchObject({ name: 'B2B Executive Proposal' });
    expect(planningPrompt.rules).toContain(
      'Treat presentationGuide as the default creative direction: follow its narrativeGuide for the argument, its visualGuide for visual pacing, and its slideRules as non-negotiable planning rules. Use requiredSections to form named stages in the narrative arc; do not omit a required section unless it conflicts with the source or target language.',
    );
  });

  it('repairs a plan that fails language QA', async () => {
    fetchMock.mockResolvedValueOnce(response([validSlide({ mainMessage: '한글 문구가 포함되었습니다.' })]))
      .mockResolvedValueOnce(response([validSlide()]));
    const result = await handler!(new Request('http://localhost', { method: 'POST', body: JSON.stringify(requestBody) }));
    expect(result.status).toBe(200);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('normalizes a repeated visual structure into a diverse slide sequence', async () => {
    const variedRequest = {
      request: { ...requestBody.request, slideCount: 4 },
    };
    const repeatedStructureSlides = Array.from({ length: 4 }, (_, index) => validSlide({
      pageNumber: index + 1,
      visualStructure: 'card-grid',
      archetype: 'card-grid',
      title: `Decision ${index + 1}`,
    }));
    fetchMock.mockResolvedValue(response(repeatedStructureSlides));

    const result = await handler!(new Request('http://localhost', { method: 'POST', body: JSON.stringify(variedRequest) }));
    const body = await result.json();

    expect(result.status).toBe(200);
    expect(body.slides.map((slide: { visualStructure: string }) => slide.visualStructure)).toEqual([
      'hero-visual',
      'message-emphasis',
      'card-grid',
      'closing-commitment',
    ]);
  });

  it('requests missing slide drafts when the model returns fewer slides than requested', async () => {
    const requestedSlides = 20;
    const initialSlides = Array.from({ length: 14 }, (_, index) => validSlide({ pageNumber: index + 1, title: `Decision ${index + 1}` }));
    const expansionSlides = Array.from({ length: 6 }, (_, index) => validSlide({ pageNumber: index + 15, title: `Extension ${index + 15}` }));
    fetchMock.mockResolvedValueOnce(response(initialSlides)).mockResolvedValueOnce(response(expansionSlides));

    const result = await handler!(new Request('http://localhost', {
      method: 'POST',
      body: JSON.stringify({ request: { ...requestBody.request, slideCount: requestedSlides } }),
    }));
    const body = await result.json();

    expect(result.status).toBe(200);
    expect(body.slides).toHaveLength(requestedSlides);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('keeps expanding a long deck when each planner response is capped to a small batch', async () => {
    const requestedSlides = 20;
    const batch = (start: number) => Array.from({ length: 5 }, (_, index) => validSlide({
      pageNumber: start + index,
      title: `Decision ${start + index}`,
    }));
    fetchMock
      .mockResolvedValueOnce(response(batch(1)))
      .mockResolvedValueOnce(response(batch(6)))
      .mockResolvedValueOnce(response(batch(11)))
      .mockResolvedValueOnce(response(batch(16)));

    const result = await handler!(new Request('http://localhost', {
      method: 'POST',
      body: JSON.stringify({ request: { ...requestBody.request, slideCount: requestedSlides } }),
    }));
    const body = await result.json();

    expect(result.status).toBe(200);
    expect(body.slides).toHaveLength(requestedSlides);
    expect(fetchMock).toHaveBeenCalledTimes(4);
    expect(JSON.parse(fetchMock.mock.calls[0][1].body).max_output_tokens).toBe(16384);
  });

  it('plans one section batch with global page numbers instead of generating the whole deck at once', async () => {
    const batchRequest = {
      request: {
        ...requestBody.request,
        slideCount: 50,
        deckBlueprint: {
          title: 'Long-form executive deck',
          strategy: validStrategy(),
          sections: [
            { id: 'context', title: 'Context', purpose: 'Frame the decision.', keyMessage: 'The current operating model creates avoidable risk.', slideStart: 1, slideCount: 10, visualFocus: ['hero-visual', 'before-after-mapping'] },
            { id: 'model', title: 'Operating model', purpose: 'Explain the model.', keyMessage: 'A governed workflow makes knowledge usable.', slideStart: 11, slideCount: 10, visualFocus: ['hub-and-spoke', 'roadmap'] },
          ],
        },
        planningBatch: { sectionId: 'model', startPage: 11, slideCount: 5, totalSlides: 50, previousSlides: [
          { pageNumber: 10, title: 'Decision context', mainMessage: 'The audience agrees on the operating gap.', decision: 'Approve the model review.' },
        ] },
      },
    };
    const sectionSlides = Array.from({ length: 5 }, (_, index) => validSlide({ pageNumber: index + 1, title: `Model decision ${index + 1}` }));
    fetchMock.mockResolvedValue(response(sectionSlides));

    const result = await handler!(new Request('http://localhost', { method: 'POST', body: JSON.stringify(batchRequest) }));
    const body = await result.json();
    const sent = JSON.parse(fetchMock.mock.calls[0][1].body) as { input: Array<{ content: Array<{ text: string }> }> };
    const prompt = JSON.parse(sent.input[0].content[0].text) as Record<string, unknown>;

    expect(result.status).toBe(200);
    expect(body.slides.map((slide: { pageNumber: number }) => slide.pageNumber)).toEqual([11, 12, 13, 14, 15]);
    expect(prompt.requestedSlideCount).toBe(5);
    expect(prompt.totalDeckSlideCount).toBe(50);
    expect(prompt.activeSection).toMatchObject({ id: 'model', slideStart: 11 });
  });

  it('uses the Blueprint deck strategy when validating an isolated section', async () => {
    const batchRequest = {
      request: {
        ...requestBody.request,
        slideCount: 20,
        deckBlueprint: {
          title: 'Long-form executive deck',
          strategy: validStrategy(),
          sections: [
            { id: 'conclusion', title: 'Conclusion', purpose: 'Confirm the commitment.', keyMessage: 'Approve the next investment decision.', slideStart: 11, slideCount: 2, visualFocus: ['closing-commitment'] },
          ],
        },
        planningBatch: { sectionId: 'conclusion', startPage: 11, slideCount: 2, totalSlides: 20 },
      },
    };
    const localOnlyStrategy = {
      coreThesis: 'Approve the next investment decision.',
      audienceNeed: 'Leaders need an accountable close.',
      desiredOutcome: 'Approve the investment.',
      narrativeArc: [{ phase: 'Action', purpose: 'Confirm the decision.', slideNumbers: [11, 12] }],
    };
    fetchMock.mockResolvedValue(response([
      validSlide({ pageNumber: 1, title: 'Confirm The Investment' }),
      validSlide({ pageNumber: 2, title: 'Approve The Next Step', visualStructure: 'closing-commitment', archetype: 'closing' }),
    ], localOnlyStrategy));

    const result = await handler!(new Request('http://localhost', { method: 'POST', body: JSON.stringify(batchRequest) }));
    const body = await result.json();

    expect(result.status).toBe(200);
    expect(body.strategy).toEqual(validStrategy());
  });

  it('allows standard uppercase abbreviations in Korean slide copy', async () => {
    const koreanRequest = {
      request: { ...requestBody.request, targetLanguage: 'Korean' as const },
    };
    fetchMock.mockResolvedValue(response([validSlide({
      title: 'R&D \uACC4\uD68D\uC11C',
      subtitle: 'R&D \uACC4\uD68D\uC11C\uB97C \uC2E4\uD589 \uACC4\uD68D\uC73C\uB85C \uC815\uB9AC\uD569\uB2C8\uB2E4.',
      objective: 'R&D \uACC4\uD68D\uC11C\uC5D0\uC11C \uC6B0\uC120\uC21C\uC704\uC640 \uCC45\uC784\uC744 \uC815\uD569\uB2C8\uB2E4.',
      mainMessage: 'R&D \uACC4\uD68D\uC11C\uB294 \uAC80\uC99D \uAE30\uC900\uACFC \uC2E4\uD589 \uCC45\uC784\uC744 \uAC19\uC774 \uB2F4\uC544\uC57C \uD569\uB2C8\uB2E4.',
      labels: ['R&D \uBAA9\uD45C', '\uAC80\uC99D \uAE30\uC900', '\uC2E4\uD589 \uCC45\uC784'],
      contentBlocks: [
        { heading: 'R&D \uBAA9\uD45C', detail: '\uD575\uC2EC \uACFC\uC81C\uC640 \uAE30\uB300 \uACB0\uACFC\uB97C \uBA85\uD655\uD788 \uC815\uC758\uD569\uB2C8\uB2E4.' },
        { heading: '\uAC80\uC99D \uAE30\uC900', detail: '\uCD9C\uCC98\uC640 \uAC00\uC815\uC744 \uD655\uC778\uD558\uC5EC \uACB0\uACFC\uC758 \uC2E0\uB8B0\uB3C4\uB97C \uB192\uC785\uB2C8\uB2E4.' },
        { heading: '\uC2E4\uD589 \uCC45\uC784', detail: '\uB2E4\uC74C \uB2E8\uACC4\uC758 \uC624\uB108\uC640 \uAC80\uD1A0 \uC2DC\uC810\uC744 \uBB38\uC11C\uD654\uD569\uB2C8\uB2E4.' },
      ],
      decision: 'R&D \uACC4\uD68D\uC11C\uC758 \uCCAB \uC2E4\uD589 \uACFC\uC81C\uC640 \uCC45\uC784\uC790\uB97C \uD655\uC815\uD569\uB2C8\uB2E4.',
      takeaway: 'R&D \uACC4\uD68D\uC11C\uB294 \uBAA9\uD45C\uC640 \uAC80\uC99D, \uC2E4\uD589 \uCC45\uC784\uC744 \uD568\uAED8 \uC815\uB9AC\uD569\uB2C8\uB2E4.',
    })]));

    const result = await handler!(new Request('http://localhost', { method: 'POST', body: JSON.stringify(koreanRequest) }));
    expect(result.status).toBe(200);
  });

  it('repairs a plan that does not include enough supporting proof points', async () => {
    fetchMock.mockResolvedValueOnce(response([validSlide({ contentBlocks: [{ heading: 'Set intent', detail: 'Short detail.' }] })]))
      .mockResolvedValueOnce(response([validSlide()]));
    const result = await handler!(new Request('http://localhost', { method: 'POST', body: JSON.stringify(requestBody) }));
    expect(result.status).toBe(200);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('requires richer proof points when detailed content is selected', async () => {
    const detailedRequest = { request: { ...requestBody.request, contentDensity: 'detailed' } };
    const detailedBlocks = [
      { heading: 'Set intent', detail: 'State the decision, audience, risk boundary, and expected business outcome before anyone begins drafting the response.' },
      { heading: 'Verify evidence', detail: 'Link material claims to identifiable source material, flag uncertainty, and record the assumptions reviewers must inspect before approval.' },
      { heading: 'Review trade-offs', detail: 'Compare feasible options using explicit benefits, limitations, dependencies, and operating risks instead of a generic preference statement.' },
      { heading: 'Assign ownership', detail: 'Name the accountable owner, review cadence, escalation route, and decision checkpoint required to move the work forward safely.' },
      { heading: 'Measure adoption', detail: 'Track source coverage, review completion, decision speed, and outcome quality using only measures supported by the supplied material.' },
    ];
    fetchMock.mockResolvedValue(response([validSlide({ labels: detailedBlocks.map((block) => block.heading), contentBlocks: detailedBlocks })]));

    const result = await handler!(new Request('http://localhost', { method: 'POST', body: JSON.stringify(detailedRequest) }));
    const body = await result.json();

    expect(result.status).toBe(200);
    expect(body.slides[0].contentBlocks).toHaveLength(5);
  });
});
