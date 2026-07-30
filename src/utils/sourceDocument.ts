import mammoth from 'mammoth';
import { getDocument, GlobalWorkerOptions } from 'pdfjs-dist/legacy/build/pdf.mjs';
import JSZip from 'jszip';
import type { SourceDocument, SourceDocumentType } from '@/types/models/pptMaker.model';

const MAX_SOURCE_FILE_SIZE_BYTES = 25 * 1024 * 1024;
const MAX_EXTRACTED_CHARACTERS = 75_000;

GlobalWorkerOptions.workerSrc = new URL('pdfjs-dist/legacy/build/pdf.worker.mjs', import.meta.url).toString();

export interface ExtractedSourceDocument {
  document: SourceDocument;
  text: string;
}

export async function extractSourceDocument(file: File): Promise<ExtractedSourceDocument> {
  const type = getSourceDocumentType(file.name);
  if (!type) {
    throw new Error('Upload a DOCX, PDF, or PPTX file.');
  }
  if (file.size > MAX_SOURCE_FILE_SIZE_BYTES) {
    throw new Error('Source documents must be 25 MB or smaller.');
  }

  const rawText = await extractTextByType(file, type);
  const text = normalizeExtractedText(rawText);
  if (!text) {
    throw new Error('No readable text was found in this document.');
  }

  const limitedText = text.slice(0, MAX_EXTRACTED_CHARACTERS);
  return {
    document: {
      name: file.name,
      type,
      extractedCharacterCount: limitedText.length,
    },
    text: limitedText,
  };
}

export function getSourceDocumentType(fileName: string): SourceDocumentType | null {
  const extension = fileName.trim().toLowerCase().split('.').pop();
  if (extension === 'docx' || extension === 'pdf' || extension === 'pptx') {
    return extension;
  }
  return null;
}

export function normalizeExtractedText(value: string): string {
  return value
    .replace(/\u0000/g, ' ')
    .replace(/\r\n?/g, '\n')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/[ \t]{2,}/g, ' ')
    .trim();
}

async function extractTextByType(file: File, type: SourceDocumentType): Promise<string> {
  if (type === 'docx') {
    const result = await mammoth.extractRawText({ arrayBuffer: await file.arrayBuffer() });
    return result.value;
  }
  if (type === 'pdf') {
    return extractPdfText(file);
  }
  return extractPptxText(file);
}

async function extractPdfText(file: File): Promise<string> {
  const document = await getDocument({ data: new Uint8Array(await file.arrayBuffer()) }).promise;
  const pages: string[] = [];

  for (let pageNumber = 1; pageNumber <= document.numPages; pageNumber += 1) {
    const page = await document.getPage(pageNumber);
    const content = await page.getTextContent();
    const pageText = content.items
      .map((item) => ('str' in item ? item.str : ''))
      .filter(Boolean)
      .join(' ');
    if (pageText) {
      pages.push(`Page ${pageNumber}\n${pageText}`);
    }
  }

  return pages.join('\n\n');
}

async function extractPptxText(file: File): Promise<string> {
  const archive = await JSZip.loadAsync(await file.arrayBuffer());
  const slideEntries = Object.values(archive.files)
    .filter((entry) => /^ppt\/slides\/slide\d+\.xml$/u.test(entry.name))
    .sort((left, right) => getSlideNumber(left.name) - getSlideNumber(right.name));

  const slides = await Promise.all(
    slideEntries.map(async (entry) => {
      const xml = await entry.async('text');
      const text = extractOpenXmlText(xml);
      return text ? `Slide ${getSlideNumber(entry.name)}\n${text}` : '';
    }),
  );

  return slides.filter(Boolean).join('\n\n');
}

function getSlideNumber(path: string): number {
  const match = path.match(/slide(\d+)\.xml$/u);
  return match ? Number(match[1]) : Number.MAX_SAFE_INTEGER;
}

function extractOpenXmlText(xml: string): string {
  const document = new DOMParser().parseFromString(xml, 'application/xml');
  const textNodes = Array.from(document.getElementsByTagNameNS('http://schemas.openxmlformats.org/drawingml/2006/main', 't'));
  return textNodes.map((node) => node.textContent ?? '').filter(Boolean).join(' ');
}
