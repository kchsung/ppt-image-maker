import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import pptxgen from 'pptxgenjs';

const JOB_ID = process.argv[2];
const OUTPUT_ARG = process.argv[3];

if (!JOB_ID) {
  throw new Error('Usage: node scripts/export-admin-pptx.mjs <generation-job-id> [output-path]');
}

const env = await readDotEnv(path.resolve('.env'));
const supabaseUrl = env.VITE_SUPABASE_URL;
const anonKey = env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !anonKey) {
  throw new Error('VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY are required in .env.');
}

const outputPath =
  OUTPUT_ARG ??
  path.join(os.homedir(), 'Downloads', `qlearn-admin-${JOB_ID.slice(0, 8)}.pptx`);

const job = await fetchGenerationJob(supabaseUrl, anonKey, JOB_ID);
const imageDeck = createImageDeckFromJob(job);
const enhancement = await fetchClaudeEnhancement(supabaseUrl, anonKey, imageDeck);
await exportPptx(job, imageDeck, enhancement, outputPath);

console.log(JSON.stringify({ outputPath, title: enhancement.title, slides: imageDeck.images.length }, null, 2));

async function readDotEnv(filePath) {
  const text = await fs.readFile(filePath, 'utf8');
  return Object.fromEntries(
    text
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line && !line.startsWith('#') && line.includes('='))
      .map((line) => {
        const index = line.indexOf('=');
        return [line.slice(0, index).trim(), line.slice(index + 1).trim().replace(/^"|"$/g, '')];
      }),
  );
}

async function fetchGenerationJob(baseUrl, key, jobId) {
  const response = await fetch(`${baseUrl}/functions/v1/list-ppt-generation-jobs`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      apikey: key,
      Authorization: `Bearer ${key}`,
    },
    body: '{}',
  });

  if (!response.ok) {
    throw new Error(`Failed to load generation jobs: ${response.status} ${await response.text()}`);
  }

  const payload = await response.json();
  const job = payload.jobs?.find((candidate) => candidate.id === jobId);
  if (!job) {
    throw new Error(`Generation job not found: ${jobId}`);
  }
  if (job.status !== 'succeeded') {
    throw new Error(`Generation job must be succeeded before PPTX export. Current status: ${job.status}`);
  }
  if (!job.deckPlan) {
    throw new Error('Generation job does not include deckPlan.');
  }

  return job;
}

function createImageDeckFromJob(job) {
  const images = job.items
    .slice()
    .sort((left, right) => left.pageNumber - right.pageNumber)
    .map((item) => {
      const slide = job.deckPlan.slides.find((candidate) => candidate.pageNumber === item.pageNumber);
      if (!slide || !item.imageUrl) {
        throw new Error(`Slide ${item.pageNumber} is missing deckPlan or imageUrl.`);
      }

      return {
        id: item.id,
        slideId: slide.id,
        pageNumber: item.pageNumber,
        title: slide.title,
        imageUrl: item.imageUrl,
        storagePath: item.outputPath,
        generationItemId: item.id,
        prompt: slide.imagePrompt,
        provider: 'openai',
      };
    });

  return {
    id: `image-deck-${job.id}`,
    deckPlanId: job.deckPlan.id,
    generationJobId: job.id,
    createdAt: new Date().toISOString(),
    images,
  };
}

async function fetchClaudeEnhancement(baseUrl, key, imageDeck) {
  const response = await fetch(`${baseUrl}/functions/v1/enhance-ppt-document`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      apikey: key,
      Authorization: `Bearer ${key}`,
    },
    body: JSON.stringify({ imageDeck }),
  });

  if (!response.ok) {
    const message = await response.text();
    console.warn(`Claude enhancement failed, using local fallback: ${response.status} ${message}`);
    return createFallbackEnhancement(imageDeck);
  }

  return response.json();
}

function createFallbackEnhancement(imageDeck) {
  return {
    title: imageDeck.images[0]?.title ?? 'QLEARN Image Deck',
    fileName: `qlearn-admin-${imageDeck.generationJobId.slice(0, 8)}.pptx`,
    speakerNotes: imageDeck.images.map((image) => ({
      pageNumber: image.pageNumber,
      note: `Explain the key message of "${image.title}" and connect it to the next slide.`,
    })),
    qaChecklist: [
      'Confirm page numbers match the source order.',
      'Check editable PPT text for language consistency.',
      'Verify generated visuals do not contain baked-in placeholder text.',
    ],
  };
}

async function exportPptx(job, imageDeck, enhancement, filePath) {
  const pptx = new pptxgen();
  pptx.layout = 'LAYOUT_WIDE';
  pptx.author = 'QLEARN';
  pptx.company = 'QLEARN';
  pptx.subject = 'Editable presentation deck';
  pptx.title = enhancement.title ?? job.deckPlan.title;
  pptx.lang = job.deckPlan.request?.targetLanguage === 'Korean' ? 'ko-KR' : 'en-US';

  for (const image of imageDeck.images) {
    const plan = job.deckPlan.slides.find((slide) => slide.id === image.slideId);
    if (!plan) {
      continue;
    }

    const slide = pptx.addSlide();
    slide.background = { color: 'FFFFFF' };
    addEditableSlide(pptx, slide, plan, await imageUrlToDataUrl(image.imageUrl), job.deckPlan.request?.logoImageDataUrl);

    const note = enhancement.speakerNotes?.find((item) => item.pageNumber === image.pageNumber)?.note;
    if (note && typeof slide.addNotes === 'function') {
      slide.addNotes(note);
    }
  }

  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await pptx.writeFile({ fileName: filePath });
}

function addEditableSlide(pptx, slide, plan, imageDataUrl, logoImageDataUrl) {
  const fontFace = 'Pretendard';
  slide.addShape(pptx.ShapeType.rect, {
    x: 0.55,
    y: 0.42,
    w: 0.07,
    h: 0.95,
    fill: { color: 'FE6621' },
    line: { color: 'FE6621' },
  });
  slide.addText(cleanText(plan.title), {
    x: 0.8,
    y: 0.34,
    w: 8.1,
    h: 0.52,
    fontFace,
    fontSize: 24,
    bold: true,
    color: '0B2454',
    fit: 'shrink',
    margin: 0,
  });
  slide.addText(cleanText(plan.subtitle), {
    x: 0.8,
    y: 0.95,
    w: 8.1,
    h: 0.32,
    fontFace,
    fontSize: 11,
    color: '6B7280',
    fit: 'shrink',
    margin: 0,
  });
  slide.addText(cleanText(plan.mainMessage), {
    x: 0.8,
    y: 1.42,
    w: 7.35,
    h: 0.6,
    fontFace,
    fontSize: 13,
    color: '333333',
    fit: 'shrink',
    margin: 0.04,
  });
  slide.addImage({
    data: imageDataUrl,
    x: 6.85,
    y: 1.25,
    w: 5.85,
    h: 3.75,
    transparency: 18,
  });

  addCards(pptx, slide, plan, fontFace);
  addTakeaway(pptx, slide, plan, fontFace);
  addFooter(pptx, slide, plan, fontFace, logoImageDataUrl);
}

function addCards(pptx, slide, plan, fontFace) {
  const labels = (plan.labels?.length ? plan.labels : ['Context', 'Decision', 'Action']).slice(0, 5);
  const cardW = labels.length >= 5 ? 2.2 : 2.55;
  const gap = labels.length >= 5 ? 0.18 : 0.24;
  const totalW = labels.length * cardW + (labels.length - 1) * gap;
  const startX = Math.max(0.75, (13.333 - totalW) / 2);
  const colors = ['EFF5FE', 'EEF8F6', 'FEF7EE', 'F5F1FE'];

  labels.forEach((label, index) => {
    const x = startX + index * (cardW + gap);
    slide.addShape(pptx.ShapeType.roundRect, {
      x,
      y: 3.15,
      w: cardW,
      h: 1.55,
      rectRadius: 0.08,
      fill: { color: colors[index % colors.length] },
      line: { color: 'E5EAF2', width: 0.75 },
    });
    slide.addShape(pptx.ShapeType.ellipse, {
      x: x + 0.18,
      y: 3.36,
      w: 0.42,
      h: 0.42,
      fill: { color: index % 2 === 0 ? '0B2454' : 'FE6621' },
      line: { color: 'FFFFFF', transparency: 100 },
    });
    slide.addText(String(index + 1).padStart(2, '0'), {
      x: x + 0.18,
      y: 3.45,
      w: 0.42,
      h: 0.18,
      fontFace,
      fontSize: 7,
      bold: true,
      color: 'FFFFFF',
      align: 'center',
      margin: 0,
      fit: 'shrink',
    });
    slide.addText(cleanText(label), {
      x: x + 0.22,
      y: 3.92,
      w: cardW - 0.44,
      h: 0.28,
      fontFace,
      fontSize: 13,
      bold: true,
      color: '0B2454',
      align: 'center',
      fit: 'shrink',
      margin: 0,
    });
    slide.addShape(pptx.ShapeType.rect, {
      x: x + cardW / 2 - 0.23,
      y: 4.29,
      w: 0.46,
      h: 0.03,
      fill: { color: 'FE6621' },
      line: { color: 'FE6621' },
    });
    slide.addText(cleanText(`${label} point ${plan.pageNumber}`), {
      x: x + 0.22,
      y: 4.42,
      w: cardW - 0.44,
      h: 0.26,
      fontFace,
      fontSize: 7.8,
      color: '333333',
      align: 'center',
      fit: 'shrink',
      margin: 0,
    });
  });
}

function addTakeaway(pptx, slide, plan, fontFace) {
  slide.addShape(pptx.ShapeType.roundRect, {
    x: 1.15,
    y: 5.42,
    w: 11.05,
    h: 0.58,
    rectRadius: 0.28,
    fill: { color: 'FFFFFF' },
    line: { color: '0B2454', width: 1.1 },
  });
  slide.addText(cleanText(plan.takeaway), {
    x: 1.45,
    y: 5.56,
    w: 10.45,
    h: 0.25,
    fontFace,
    fontSize: 12,
    bold: true,
    color: '0B2454',
    align: 'center',
    fit: 'shrink',
    margin: 0,
  });
}

function addFooter(pptx, slide, plan, fontFace, logoImageDataUrl) {
  slide.addShape(pptx.ShapeType.line, {
    x: 0.45,
    y: 6.52,
    w: 12.45,
    h: 0,
    line: { color: 'E5EAF2', width: 0.75 },
  });
  if (logoImageDataUrl) {
    slide.addImage({
      data: logoImageDataUrl,
      x: 0.56,
      y: 6.68,
      w: 1.16,
      h: 0.36,
    });
  } else {
    slide.addShape(pptx.ShapeType.roundRect, {
      x: 0.56,
      y: 6.68,
      w: 1.16,
      h: 0.36,
      rectRadius: 0.06,
      fill: { color: 'FFFFFF' },
      line: { color: 'E5EAF2', width: 0.75 },
    });
    slide.addText('로고', {
      x: 0.56,
      y: 6.77,
      w: 1.16,
      h: 0.16,
      fontFace,
      fontSize: 8,
      bold: true,
      color: '85878A',
      align: 'center',
      margin: 0,
      fit: 'shrink',
    });
  }
  slide.addText(cleanText(plan.title), {
    x: 2.1,
    y: 6.78,
    w: 5.8,
    h: 0.18,
    fontFace,
    fontSize: 8.5,
    color: '85878A',
    margin: 0,
    fit: 'shrink',
  });
  slide.addShape(pptx.ShapeType.ellipse, {
    x: 12.4,
    y: 6.66,
    w: 0.44,
    h: 0.44,
    fill: { color: '062354' },
    line: { color: '062354' },
  });
  slide.addText(String(plan.pageNumber).padStart(2, '0'), {
    x: 12.4,
    y: 6.77,
    w: 0.44,
    h: 0.16,
    fontFace,
    fontSize: 9,
    bold: true,
    color: 'FFFFFF',
    align: 'center',
    margin: 0,
  });
}

async function imageUrlToDataUrl(imageUrl) {
  const response = await fetch(imageUrl);
  if (!response.ok) {
    throw new Error(`Failed to fetch image: ${response.status}`);
  }

  const contentType = response.headers.get('content-type') ?? 'image/png';
  const buffer = Buffer.from(await response.arrayBuffer());
  return `data:${contentType};base64,${buffer.toString('base64')}`;
}

function cleanText(value) {
  return String(value ?? '')
    .replace(/[.]{3,}|[…]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}
