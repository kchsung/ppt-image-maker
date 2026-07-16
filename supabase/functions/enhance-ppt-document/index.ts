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
    const apiKey = Deno.env.get('OPENAI_API_KEY');
    if (!apiKey) {
      return json({ error: 'OPENAI_API_KEY is not configured.' }, 500);
    }

    const model = Deno.env.get('OPENAI_TEXT_MODEL') ?? 'gpt-5.6';
    const body = (await req.json()) as { imageDeck?: GeneratedImageDeck };
    const imageDeck = body.imageDeck;

    if (!imageDeck || !Array.isArray(imageDeck.images)) {
      return json({ error: 'imageDeck with images is required.' }, 400);
    }

    const response = await fetch('https://api.openai.com/v1/responses', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model,
        input: [
          {
            role: 'system',
            content:
              'You are a senior presentation editor. Create concise PPT document metadata for an image-based deck. Return strict JSON only.',
          },
          {
            role: 'user',
            content: JSON.stringify({
              task: 'Enhance generated slide images into a PPT document plan.',
              requirements: [
                'Create a clean deck title.',
                'Create a safe file name ending in .pptx.',
                'Write one speaker note per slide.',
                'Write a short QA checklist for final review.',
              ],
              slides: imageDeck.images.map((image) => ({
                pageNumber: image.pageNumber,
                title: image.title,
                prompt: image.prompt,
              })),
            }),
          },
        ],
        text: {
          format: {
            type: 'json_schema',
            name: 'ppt_document_enhancement',
            schema: {
              type: 'object',
              additionalProperties: false,
              required: ['title', 'fileName', 'speakerNotes', 'qaChecklist'],
              properties: {
                title: { type: 'string' },
                fileName: { type: 'string' },
                speakerNotes: {
                  type: 'array',
                  items: {
                    type: 'object',
                    additionalProperties: false,
                    required: ['pageNumber', 'note'],
                    properties: {
                      pageNumber: { type: 'number' },
                      note: { type: 'string' },
                    },
                  },
                },
                qaChecklist: {
                  type: 'array',
                  items: { type: 'string' },
                },
              },
            },
          },
        },
      }),
    });

    const payload = await response.json();
    if (!response.ok) {
      throw new Error(payload?.error?.message ?? 'OpenAI document enhancement failed.');
    }

    const outputText = payload?.output_text;
    if (typeof outputText !== 'string') {
      throw new Error('OpenAI response did not include output_text.');
    }

    return json(JSON.parse(outputText));
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : 'Unknown error' }, 500);
  }
});

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      ...corsHeaders,
      'Content-Type': 'application/json',
    },
  });
}
