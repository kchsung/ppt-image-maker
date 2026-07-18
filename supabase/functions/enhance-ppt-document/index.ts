type SlidePlan = {
  id: string;
  pageNumber: number;
  archetype: string;
  visualStructure: string;
  mainMessage: string;
  title: string;
  subtitle: string;
  labels: string[];
  takeaway: string;
};

type DeckPlan = {
  title: string;
  request: {
    targetLanguage: 'English' | 'Korean';
    audience: string;
    purpose: string;
    logoImageDataUrl?: string;
  };
};

type SlideImage = {
  pageNumber: number;
  imageDataUrl?: string;
  imageUrl?: string;
};

type TextBlock = {
  id: string;
  role: 'title' | 'subtitle' | 'main-message' | 'label' | 'body' | 'takeaway' | 'footer' | 'logo';
  text: string;
  x: number;
  y: number;
  w: number;
  h: number;
  fontSize: number;
  bold?: boolean;
  color?: string;
  align?: 'left' | 'center' | 'right';
};

type SlideLayout = {
  pageNumber: number;
  visualStrategy: 'rebuild-with-editables' | 'image-fallback';
  imageLayer: {
    strategy: 'full-slide-reference' | 'full-slide-fallback';
    x: number;
    y: number;
    w: number;
    h: number;
    transparency?: number;
  };
  textBlocks: TextBlock[];
  shapes: Array<{
    id: string;
    type: 'rect' | 'roundRect' | 'ellipse' | 'line';
    x: number;
    y: number;
    w: number;
    h: number;
    fillColor?: string;
    lineColor?: string;
    lineWidth?: number;
    transparency?: number;
  }>;
  qaChecks: string[];
  speakerNote: string;
  placementConfidence: number;
};

type RequestBody = {
  deckPlan?: DeckPlan;
  slide?: SlidePlan;
  image?: SlideImage;
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

    const body = (await req.json()) as RequestBody;
    if (!body.deckPlan || !body.slide || !body.image) {
      return json({ error: 'deckPlan, slide, and image are required.' }, 400);
    }

    const model = Deno.env.get('CLAUDE_MODEL') ?? 'claude-sonnet-5';
    const layout = await createEditableLayout(apiKey, model, body.deckPlan, body.slide, body.image);
    return json(layout);
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : 'Unknown error' }, 500);
  }
});

async function createEditableLayout(
  apiKey: string,
  model: string,
  deckPlan: DeckPlan,
  slide: SlidePlan,
  image: SlideImage,
): Promise<SlideLayout> {
  const imageBlock = await toImageBlock(image);
  const system = [
    'You are a senior presentation designer mapping approved slide copy into a visual-only 16:9 slide image.',
    'Return strict RFC 8259 JSON only, not a PPTX file and not markdown.',
    'The supplied image is the visual source of truth. It contains intentionally blank content slots and must remain full-slide and undistorted.',
    'Only return an editable layout when every required text item has one distinct blank slot with no visual collision. Otherwise return image-fallback.',
    'Use Pretendard for all editable text at export time.',
  ].join(' ');
  const initialMessages = [
        {
          role: 'user',
          content: [
            {
              type: 'text',
              text: JSON.stringify({
                task: 'Create a slide-specific editable layout contract.',
                slideCanvasInches: { width: 13.333, height: 7.5 },
                deckContext: deckPlan,
                slidePlan: slide,
                approvedVisibleCopy: {
                  title: { id: 'title', role: 'title', text: slide.title },
                  subtitle: { id: 'subtitle', role: 'subtitle', text: slide.subtitle },
                  labels: slide.labels.map((label, index) => ({ id: `label-${index + 1}`, role: 'label', text: label })),
                  takeaway: { id: 'takeaway', role: 'takeaway', text: slide.takeaway },
                  logo: {
                    id: 'logo',
                    role: 'logo',
                    text: deckPlan.request.logoImageDataUrl ? '' : '\uB85C\uACE0',
                    fixedBox: { x: 11.62, y: 0.38, w: 1.12, h: 0.34 },
                  },
                },
                speakerNote: slide.mainMessage,
                requirements: [
                  'Inspect the image before placing text. Use each approvedVisibleCopy item exactly once, preserving its id, role, and text.',
                  'Do not create a visible main-message, body, or footer block. The main message belongs only in speaker notes.',
                  'Use rebuild-with-editables only when every visible-copy item fits a distinct blank slot without collision. Otherwise use image-fallback.',
                  'For rebuild-with-editables, use a full-slide-reference image layer at x 0, y 0, w 13.333, h 7.5 with no transparency.',
                  'For rebuild-with-editables, return no shapes. The source image already contains the visual design.',
                  'For image-fallback, return no textBlocks or shapes and set placementConfidence below 85.',
                  'For rebuild-with-editables, set placementConfidence from 85 to 100.',
                  'Analyze the provided image for whitespace and visual complexity.',
                  'Use visualStrategy rebuild-with-editables when the visual can be supported by simple shapes and editable text; use image-fallback for complex diagrams or decorative assets.',
                  'Keep the generated image as a visual-only layer. Do not rely on it for readable text.',
                  'Return the exact approved slide-plan copy in editable text blocks. Do not rewrite, add, truncate, translate, or mix languages.',
                  'Add an editable logo block in the top-right corner only. Use x 11.62, y 0.38, w 1.12, h 0.34. Use text "로고" only when no logo was supplied. When a logo exists, still reserve that exact position but set its text to an empty string.',
                  'Use a full-slide image layer only for image-fallback. For rebuild-with-editables, place the image only in the relevant visual area with at most 25% transparency.',
                  'Text must not overlap visuals and must fit in the specified boxes.',
                  'Avoid ellipses, placeholders, page markers, template text, or clipped text.',
                ],
                outputContract: {
                  pageNumber: 'number',
                  visualStrategy: 'rebuild-with-editables | image-fallback',
                  placementConfidence: 'integer from 0 to 100',
                  imageLayer: {
                    strategy: 'full-slide-reference | full-slide-fallback',
                    x: 0, y: 0, w: 13.333, h: 7.5,
                  },
                  textBlocks: [
                    {
                      id: 'stable string',
                      role: 'title | subtitle | label | takeaway | logo',
                      text: 'exact approvedVisibleCopy text',
                      x: 'inches', y: 'inches', w: 'inches', h: 'inches',
                      fontSize: 'points', bold: 'boolean optional', color: 'six-digit RGB optional',
                      align: 'left | center | right optional',
                    },
                  ],
                  shapes: [],
                  qaChecks: ['short strings'],
                  speakerNote: 'one concise sentence',
                },
              }),
            },
            imageBlock,
          ],
        },
      ];
  const payload = await requestClaude(apiKey, model, system, initialMessages);
  const text = extractClaudeText(payload);

  if (!text) {
    throw new Error('Claude editable layout generation did not include text output.');
  }

  return normalizeLayout(JSON.parse(extractJson(text)), slide, Boolean(deckPlan.request.logoImageDataUrl));
}

async function requestClaude(
  apiKey: string,
  model: string,
  system: string,
  messages: Array<Record<string, unknown>>,
): Promise<Record<string, unknown>> {
  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model,
      max_tokens: 4096,
      thinking: { type: 'disabled' },
      system,
      messages,
    }),
  });
  const payload = await response.json();
  if (!response.ok) {
    throw new Error(payload?.error?.message ?? 'Claude editable layout generation failed.');
  }
  return payload as Record<string, unknown>;
}

async function toImageBlock(image: SlideImage): Promise<Record<string, unknown>> {
  const dataUrl = image.imageDataUrl ?? (image.imageUrl ? await fetchImageAsDataUrl(image.imageUrl) : null);
  if (!dataUrl) {
    throw new Error(`Slide ${image.pageNumber} does not include image data.`);
  }

  const match = dataUrl.match(/^data:(image\/(?:png|jpeg|webp|gif));base64,(.+)$/u);
  if (!match) {
    throw new Error(`Slide ${image.pageNumber} image must be a supported base64 image.`);
  }

  return {
    type: 'image',
    source: {
      type: 'base64',
      media_type: match[1],
      data: match[2],
    },
  };
}

async function fetchImageAsDataUrl(imageUrl: string): Promise<string> {
  const response = await fetch(imageUrl);
  if (!response.ok) {
    throw new Error(`Failed to load generated slide image: ${response.status}`);
  }
  const mimeType = response.headers.get('content-type') ?? 'image/png';
  const bytes = new Uint8Array(await response.arrayBuffer());
  let binary = '';
  bytes.forEach((byte) => {
    binary += String.fromCharCode(byte);
  });
  return `data:${mimeType};base64,${btoa(binary)}`;
}

function normalizeLayout(value: unknown, slide: SlidePlan, hasLogo: boolean): SlideLayout {
  const record = isRecord(value) ? value : {};
  const visualStrategy = record.visualStrategy === 'image-fallback' ? 'image-fallback' : 'rebuild-with-editables';
  const textBlocks = Array.isArray(record.textBlocks)
    ? record.textBlocks.map((block, index) => normalizeTextBlock(block, index, slide, hasLogo)).filter(Boolean) as TextBlock[]
    : [];

  const required = requiredTextBlocks(slide, hasLogo);
  const existingRoles = new Set(textBlocks.map((block) => block.role));
  required.forEach((block) => {
    if (!existingRoles.has(block.role)) {
      textBlocks.push(block);
    }
  });

  return {
    pageNumber: slide.pageNumber,
    visualStrategy,
    imageLayer: {
      strategy: visualStrategy === 'image-fallback' ? 'full-slide-fallback' : 'full-slide-reference',
      x: 0,
      y: 0,
      w: 13.333,
      h: 7.5,
      transparency: 0,
    },
    textBlocks,
    shapes: Array.isArray(record.shapes) ? record.shapes.map(normalizeShape).filter(Boolean) : [],
    qaChecks: Array.isArray(record.qaChecks) ? record.qaChecks.map(toText).filter(Boolean).slice(0, 6) : [],
    speakerNote: toText(record.speakerNote) || slide.mainMessage,
    placementConfidence: boundedNumber(record.placementConfidence, 0, 0, 100),
  };
}

function normalizeTextBlock(value: unknown, index: number, slide: SlidePlan, hasLogo: boolean): TextBlock | null {
  if (!isRecord(value)) return null;
  const role = toText(value.role) as TextBlock['role'];
  if (!['title', 'subtitle', 'main-message', 'label', 'body', 'takeaway', 'footer', 'logo'].includes(role)) return null;
  const fallback = requiredTextBlocks(slide, hasLogo).find((block) => block.role === role);
  const fixedLogoPosition = role === 'logo' ? { x: 11.62, y: 0.38, w: 1.12, h: 0.34 } : null;
  return {
    id: toText(value.id) || `${role}-${index + 1}`,
    role,
    text: role === 'logo' && hasLogo ? '' : toText(value.text) || fallback?.text || '',
    x: fixedLogoPosition?.x ?? boundedNumber(value.x, fallback?.x ?? 0.8, 0, 13.1),
    y: fixedLogoPosition?.y ?? boundedNumber(value.y, fallback?.y ?? 0.4, 0, 7.35),
    w: fixedLogoPosition?.w ?? boundedNumber(value.w, fallback?.w ?? 3, 0.2, 13.333),
    h: fixedLogoPosition?.h ?? boundedNumber(value.h, fallback?.h ?? 0.3, 0.12, 7.5),
    fontSize: boundedNumber(value.fontSize, fallback?.fontSize ?? 12, 6, 42),
    bold: Boolean(value.bold ?? fallback?.bold),
    color: validHex(value.color) ?? fallback?.color,
    align: value.align === 'center' || value.align === 'right' ? value.align : fallback?.align ?? 'left',
  };
}

function normalizeShape(value: unknown, index: number): SlideLayout['shapes'][number] | null {
  if (!isRecord(value)) return null;
  const type = toText(value.type);
  if (!['rect', 'roundRect', 'ellipse', 'line'].includes(type)) return null;
  return {
    id: toText(value.id) || `shape-${index + 1}`,
    type: type as SlideLayout['shapes'][number]['type'],
    x: boundedNumber(value.x, 0.5, 0, 13.1),
    y: boundedNumber(value.y, 0.5, 0, 7.35),
    w: boundedNumber(value.w, 0.5, 0, 13.333),
    h: boundedNumber(value.h, 0.1, 0, 7.5),
    fillColor: validHex(value.fillColor) ?? undefined,
    lineColor: validHex(value.lineColor) ?? undefined,
    lineWidth: boundedNumber(value.lineWidth, 0.75, 0, 8),
    transparency: boundedNumber(value.transparency, 0, 0, 100),
  };
}

function requiredTextBlocks(slide: SlidePlan, hasLogo: boolean): TextBlock[] {
  const blocks: TextBlock[] = [
    { id: 'title', role: 'title', text: slide.title, x: 0.8, y: 0.35, w: 7.4, h: 0.55, fontSize: 24, bold: true, color: '0B2454' },
    { id: 'subtitle', role: 'subtitle', text: slide.subtitle, x: 0.8, y: 0.95, w: 7.6, h: 0.35, fontSize: 11, color: '6B7280' },
    { id: 'main-message', role: 'main-message', text: slide.mainMessage, x: 0.8, y: 1.45, w: 5.6, h: 0.7, fontSize: 13, color: '333333' },
    { id: 'takeaway', role: 'takeaway', text: slide.takeaway, x: 1.3, y: 5.55, w: 10.6, h: 0.28, fontSize: 12, bold: true, color: '0B2454', align: 'center' },
    { id: 'footer', role: 'footer', text: slide.title, x: 4.1, y: 6.78, w: 4.3, h: 0.18, fontSize: 8.5, color: '85878A' },
    { id: 'logo', role: 'logo', text: hasLogo ? '' : '로고', x: 11.62, y: 0.38, w: 1.12, h: 0.34, fontSize: 8, bold: true, color: '85878A', align: 'center' },
  ];

  slide.labels.slice(0, 5).forEach((label, index) => {
    blocks.push({
      id: `label-${index + 1}`,
      role: 'label',
      text: label,
      x: 0.9 + index * 2.35,
      y: 3.95,
      w: 1.95,
      h: 0.3,
      fontSize: 13,
      bold: true,
      color: '0B2454',
      align: 'center',
    });
  });

  return blocks;
}

function extractClaudeText(payload: Record<string, unknown>): string | null {
  const content = payload.content;
  if (!Array.isArray(content)) return null;
  return content.map((part) => isRecord(part) && typeof part.text === 'string' ? part.text : '').join('\n').trim() || null;
}

function extractJson(text: string): string {
  const trimmed = text.trim();
  if (trimmed.startsWith('{') && trimmed.endsWith('}')) return trimmed;
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/iu);
  if (fenced?.[1]) return fenced[1].trim();
  const start = trimmed.indexOf('{');
  const end = trimmed.lastIndexOf('}');
  if (start >= 0 && end > start) return trimmed.slice(start, end + 1);
  throw new Error('Claude editable layout generation did not return valid JSON.');
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function toText(value: unknown): string {
  return typeof value === 'string' ? value.replace(/\s+/g, ' ').trim() : '';
}

function boundedNumber(value: unknown, fallback: number, min: number, max: number): number {
  const number = typeof value === 'number' && Number.isFinite(value) ? value : fallback;
  return Math.min(Math.max(number, min), max);
}

function validHex(value: unknown): string | null {
  return typeof value === 'string' && /^[A-Fa-f0-9]{6}$/.test(value) ? value.toUpperCase() : null;
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
