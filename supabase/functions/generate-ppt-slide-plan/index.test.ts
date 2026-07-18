import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

type Handler = (request: Request) => Promise<Response>;

let handler: Handler | null = null;
const fetchMock = vi.fn();

const requestBody = {
  request: {
    sourceText: 'Korean source material can be translated into an English presentation.',
    targetLanguage: 'English',
    audience: 'University students',
    purpose: 'Summer school lecture',
    slideCount: 1,
    styleReference: {
      name: 'QLEARN lecture image deck',
      notes: 'Clean presentation style',
      primaryColorLabel: 'deep navy',
      accentColorLabel: 'bright orange',
    },
  },
};

function createSlide(mainMessage: string) {
  return {
    pageNumber: 1,
    archetype: 'cover',
    visualStructure: 'hero-visual',
    title: 'AI Requires Better Judgment',
    subtitle: 'Students need a clear workflow for responsible AI use.',
    mainMessage,
    labels: ['Intent', 'Draft', 'Review'],
    takeaway: 'Use AI to accelerate work while people validate the final decision.',
  };
}

function createDeckSlide(
  pageNumber: number,
  archetype: string,
  visualStructure: string,
) {
  return {
    ...createSlide(`Slide ${pageNumber} gives the audience one clear decision.`),
    pageNumber,
    archetype,
    visualStructure,
    title: `Decision ${pageNumber}`,
  };
}

function claudeResponse(slides: unknown[]) {
  return claudeTextResponse(JSON.stringify({ slides }));
}

function claudeTextResponse(text: string) {
  return new Response(JSON.stringify({
    content: [{ type: 'text', text }],
  }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
}

async function loadHandler() {
  handler = null;
  vi.resetModules();
  vi.stubGlobal('fetch', fetchMock);
  vi.stubGlobal('Deno', {
    env: {
      get: (key: string) => key === 'CLAUDE_API_KEY' ? 'test-api-key' : 'claude-sonnet-5',
    },
    serve: (nextHandler: Handler) => {
      handler = nextHandler;
    },
  });

  await import('./index.ts');
  if (!handler) {
    throw new Error('The Edge Function handler was not registered.');
  }
}

describe('generate-ppt-slide-plan Edge Function', () => {
  beforeEach(async () => {
    fetchMock.mockReset();
    await loadHandler();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('repairs Korean copy before approving an English slide plan', async () => {
    fetchMock
      .mockResolvedValueOnce(claudeResponse([createSlide('\uD55C\uAE00 \uBA54\uC2DC\uC9C0\uAC00 \uC788\uC2B5\uB2C8\uB2E4.')]))
      .mockResolvedValueOnce(claudeResponse([createSlide('AI changes execution, so students must strengthen their judgment.')]));

    const response = await handler!(new Request('http://localhost', {
      method: 'POST',
      body: JSON.stringify(requestBody),
    }));

    const body = await response.json() as { copyQa: { status: string }; slides: Array<{ mainMessage: string }> };
    expect(response.status).toBe(200);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(body.copyQa.status).toBe('passed');
    expect(body.slides[0].mainMessage).toMatch(/^[\x00-\x7F]*$/u);
  });

  it('rejects an English plan when Korean copy remains after repair', async () => {
    fetchMock
      .mockResolvedValueOnce(claudeResponse([createSlide('\uD55C\uAE00 \uBA54\uC2DC\uC9C0\uAC00 \uC788\uC2B5\uB2C8\uB2E4.')]))
      .mockResolvedValueOnce(claudeResponse([createSlide('\uD55C\uAE00 \uAC00 \uB0A8\uC544 \uC788\uC2B5\uB2C8\uB2E4.')]));

    const response = await handler!(new Request('http://localhost', {
      method: 'POST',
      body: JSON.stringify(requestBody),
    }));

    const body = await response.json() as { error: string; issues: string[] };
    expect(response.status).toBe(422);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(body.error).toContain('contains Korean copy while English was requested');
    expect(body.issues).toContain('Slide 1 contains Korean copy while English was requested.');
  });

  it('repairs malformed Claude JSON before approving the slide plan', async () => {
    const malformedJson = `{"slides":[{"pageNumber":1,"archetype":"cover","title":"AI needs "better" judgment"}]}`;
    fetchMock
      .mockResolvedValueOnce(claudeTextResponse(malformedJson))
      .mockResolvedValueOnce(claudeResponse([
        createSlide('AI changes execution, so students must strengthen their judgment.'),
      ]));

    const response = await handler!(new Request('http://localhost', {
      method: 'POST',
      body: JSON.stringify(requestBody),
    }));

    const body = await response.json() as { copyQa: { status: string }; slides: Array<{ title: string }> };
    expect(response.status).toBe(200);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(body.copyQa.status).toBe('passed');
    expect(body.slides[0].title).toBe('AI Requires Better Judgment');
  });

  it('retries once when Claude returns a non-text response block', async () => {
    fetchMock
      .mockResolvedValueOnce(new Response(JSON.stringify({
        stop_reason: 'end_turn',
        content: [{ type: 'thinking', thinking: 'Preparing a response.' }],
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }))
      .mockResolvedValueOnce(claudeResponse([
        createSlide('AI changes execution, so students must strengthen their judgment.'),
      ]));

    const response = await handler!(new Request('http://localhost', {
      method: 'POST',
      body: JSON.stringify(requestBody),
    }));

    const body = await response.json() as { copyQa: { status: string } };
    expect(response.status).toBe(200);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(body.copyQa.status).toBe('passed');
  });

  it('repairs an overlong title before approving the editable slide copy', async () => {
    fetchMock
      .mockResolvedValueOnce(claudeResponse([{
        ...createSlide('AI changes execution, so students must strengthen their judgment.'),
        title: 'A Very Long Presentation Title That Cannot Fit Inside A Two Line Editable Slide Title Box',
      }]))
      .mockResolvedValueOnce(claudeResponse([createSlide('AI changes execution, so students must strengthen their judgment.')]));

    const response = await handler!(new Request('http://localhost', {
      method: 'POST',
      body: JSON.stringify(requestBody),
    }));

    const body = await response.json() as { slides: Array<{ title: string }> };
    expect(response.status).toBe(200);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(body.slides[0].title).toBe('AI Requires Better Judgment');
  });

  it('requests a focused second repair when a title remains too long after the first repair', async () => {
    const longTitle = 'A Very Long Presentation Heading That Cannot Fit Inside A Two Line Editable Layout Box';
    fetchMock
      .mockResolvedValueOnce(claudeResponse([{
        ...createSlide('AI changes execution, so students must strengthen their judgment.'),
        title: longTitle,
      }]))
      .mockResolvedValueOnce(claudeResponse([{
        ...createSlide('AI changes execution, so students must strengthen their judgment.'),
        title: longTitle,
      }]))
      .mockResolvedValueOnce(claudeResponse([createSlide('AI changes execution, so students must strengthen their judgment.')]));

    const response = await handler!(new Request('http://localhost', {
      method: 'POST',
      body: JSON.stringify(requestBody),
    }));

    const body = await response.json() as { slides: Array<{ title: string }> };
    expect(response.status).toBe(200);
    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(body.slides[0].title).toBe('AI Requires Better Judgment');
  });

  it('repairs repeated layouts into a varied visual story before image generation', async () => {
    const fourSlideRequest = {
      request: {
        ...requestBody.request,
        slideCount: 4,
      },
    };
    const repeatedStructures = [
      createDeckSlide(1, 'cover', 'hero-visual'),
      createDeckSlide(2, 'card-grid', 'card-grid'),
      createDeckSlide(3, 'card-grid', 'card-grid'),
      createDeckSlide(4, 'closing', 'card-grid'),
    ];
    const variedStructures = [
      createDeckSlide(1, 'cover', 'hero-visual'),
      createDeckSlide(2, 'comparison', 'side-by-side-comparison'),
      createDeckSlide(3, 'process', 'numbered-process'),
      createDeckSlide(4, 'closing', 'closing-commitment'),
    ];
    fetchMock
      .mockResolvedValueOnce(claudeResponse(repeatedStructures))
      .mockResolvedValueOnce(claudeResponse(variedStructures));

    const response = await handler!(new Request('http://localhost', {
      method: 'POST',
      body: JSON.stringify(fourSlideRequest),
    }));

    const body = await response.json() as { slides: Array<{ visualStructure: string }> };
    expect(response.status).toBe(200);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(body.slides.map((slide) => slide.visualStructure)).toEqual([
      'hero-visual',
      'side-by-side-comparison',
      'numbered-process',
      'closing-commitment',
    ]);
  });

  it('rejects an unsupported target language before calling Claude', async () => {
    const response = await handler!(new Request('http://localhost', {
      method: 'POST',
      body: JSON.stringify({
        request: {
          ...requestBody.request,
          targetLanguage: 'English ',
        },
      }),
    }));

    const body = await response.json() as { error: string };
    expect(response.status).toBe(400);
    expect(body.error).toBe('A complete PPT maker request is required.');
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
