type GeneratedImageDeck = {
  id: string;
  deckPlanId: string;
  images: Array<{
    pageNumber: number;
    title: string;
    prompt: string;
  }>;
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
    const apiKey = Deno.env.get('CLAUDE_API_KEY');
    if (!apiKey) {
      return json({ error: 'CLAUDE_API_KEY is not configured.' }, 500);
    }

    const model = Deno.env.get('CLAUDE_MODEL') ?? 'claude-sonnet-5';
    const body = (await req.json()) as { imageDeck?: GeneratedImageDeck };
    const imageDeck = body.imageDeck;

    if (!imageDeck || !Array.isArray(imageDeck.images)) {
      return json({ error: 'imageDeck with images is required.' }, 400);
    }

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model,
        max_tokens: 1400,
        system:
          'You are a senior presentation editor. Create concise PPT document metadata for an image-based deck. Return strict JSON only, with no markdown fences.',
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'text',
                text: JSON.stringify({
                  task: 'Enhance generated slide images into a PPT document plan.',
                  outputContract: {
                    title: 'string',
                    fileName: 'string ending in .pptx',
                    speakerNotes: [{ pageNumber: 'number', note: 'string' }],
                    qaChecklist: ['string'],
                  },
                  requirements: [
                    'Create a clean deck title.',
                    'Create a safe file name ending in .pptx.',
                    'Write one speaker note per slide.',
                    'Write a short QA checklist for final review.',
                    'Return valid JSON only.',
                  ],
                  slides: imageDeck.images.map((image) => ({
                    pageNumber: image.pageNumber,
                    title: image.title,
                    prompt: image.prompt,
                  })),
                }),
              },
            ],
          },
        ],
      }),
    });

    const payload = await response.json();
    if (!response.ok) {
      throw new Error(payload?.error?.message ?? 'Claude document enhancement failed.');
    }

    const outputText = extractClaudeText(payload);
    if (typeof outputText !== 'string') {
      throw new Error('Claude response did not include text content.');
    }

    return json(JSON.parse(extractJson(outputText)));
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : 'Unknown error' }, 500);
  }
});

function extractClaudeText(payload: Record<string, unknown>): string | null {
  const content = payload.content;
  if (!Array.isArray(content)) {
    return null;
  }

  return content
    .map((part) => {
      if (!part || typeof part !== 'object') {
        return '';
      }

      const text = (part as { text?: unknown }).text;
      return typeof text === 'string' ? text : '';
    })
    .join('\n')
    .trim();
}

function extractJson(text: string): string {
  const trimmed = text.trim();
  if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
    return trimmed;
  }

  const fencedMatch = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fencedMatch?.[1]) {
    return fencedMatch[1].trim();
  }

  const start = trimmed.indexOf('{');
  const end = trimmed.lastIndexOf('}');
  if (start >= 0 && end > start) {
    return trimmed.slice(start, end + 1);
  }

  throw new Error('Claude response did not include valid JSON.');
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
