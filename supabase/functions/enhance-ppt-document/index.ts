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

const CLAUDE_BETA_HEADER = 'code-execution-2025-08-25,skills-2025-10-02,files-api-2025-04-14';

const QLEARN_PRESENTATION_SKILL_GUIDE = [
  'Use QLEARN/THE GPC presentation rules together with the official pptx skill.',
  'Prefer editable PPT text boxes over baked-in text whenever PowerPoint is generated later.',
  'Use a white background, navy titles, orange accent bar, restrained card grids, summary pill, and fixed footer/page number rhythm.',
  'Avoid placeholder dots, ellipses, mixed-language fragments, tiny unreadable text, and text that overflows cards.',
  'Keep slide messages decision-oriented: title, subtitle, 3-5 crisp labels, takeaway, and speaker note should reinforce one idea.',
].join('\n');

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
    const customSkillId = Deno.env.get('CLAUDE_PRESENTATION_SKILL_ID');
    const customSkillVersion = Deno.env.get('CLAUDE_PRESENTATION_SKILL_VERSION') ?? 'latest';
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
        'anthropic-beta': CLAUDE_BETA_HEADER,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model,
        max_tokens: 4096,
        container: {
          skills: [
            { type: 'anthropic', skill_id: 'pptx', version: 'latest' },
            ...(customSkillId ? [{ type: 'custom', skill_id: customSkillId, version: customSkillVersion }] : []),
          ],
        },
        tools: [{ type: 'code_execution_20250825', name: 'code_execution' }],
        system:
          'You are a senior presentation editor using Claude Skills. Use the official pptx skill and code execution capability as presentation-layout expertise, and apply the QLEARN presentation skill guide. Return strict JSON only, with no markdown fences.',
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'text',
                text: JSON.stringify({
                  task: 'Enhance generated slide images into a PPT document plan.',
                  instruction:
                    'Use the official Anthropic pptx skill plus the QLEARN presentation guide to optimize the final editable PPTX structure. Do not create or attach a PPTX file in this request; the app exports PPTX later. Return only metadata JSON.',
                  qlearnPresentationSkillGuide: QLEARN_PRESENTATION_SKILL_GUIDE,
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
