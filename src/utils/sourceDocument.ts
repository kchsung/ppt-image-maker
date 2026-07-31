import mammoth from 'mammoth';
import { getDocument, GlobalWorkerOptions } from 'pdfjs-dist/legacy/build/pdf.mjs';
import JSZip from 'jszip';
import type { SourceAttachment, SourceDocument, SourceDocumentType, SourceReference } from '@/types/models/pptMaker.model';

const MAX_SOURCE_FILE_SIZE_BYTES = 25 * 1024 * 1024;
const MAX_EXTRACTED_CHARACTERS = 75_000;
const MAX_IMAGE_SOURCE_SIZE_BYTES = 4 * 1024 * 1024;

GlobalWorkerOptions.workerSrc = new URL('pdfjs-dist/legacy/build/pdf.worker.mjs', import.meta.url).toString();

export interface ExtractedSourceDocument {
  document: SourceDocument;
  attachment: SourceAttachment;
  text: string;
}

export async function extractSourceDocument(file: File): Promise<ExtractedSourceDocument> {
  const type = getSourceDocumentType(file.name);
  if (!type) {
    throw new Error('Upload a PDF, DOCX, PPTX, XLSX, PNG, JPEG, or WEBP file.');
  }
  if (file.size > MAX_SOURCE_FILE_SIZE_BYTES) {
    throw new Error('Source documents must be 25 MB or smaller.');
  }

  if (type === 'image' && file.size > MAX_IMAGE_SOURCE_SIZE_BYTES) {
    throw new Error('Image attachments must be 4 MB or smaller.');
  }

  const rawText = await extractTextByType(file, type);
  const text = normalizeExtractedText(rawText);
  if (!text && type !== 'image') {
    throw new Error('No readable text was found in this document.');
  }

  const limitedText = text.slice(0, MAX_EXTRACTED_CHARACTERS);
  const imageDataUrl = type === 'image' ? await readFileAsDataUrl(file) : undefined;
  const attachment: SourceAttachment = {
    id: `${file.name}-${file.lastModified}-${file.size}`,
    name: file.name,
    type,
    extractedCharacterCount: limitedText.length,
    tableCount: type === 'xlsx' ? countWorkbookSheets(limitedText) : 0,
    imageCount: type === 'image' ? 1 : 0,
    imageDataUrl,
    sourceReference: createSourceReference(file, limitedText),
  };
  return {
    document: attachment,
    attachment,
    text: limitedText,
  };
}

function createSourceReference(file: File, text: string): SourceReference {
  const documentName = file.name;
  const sourceName = documentName
    .replace(/\.[^.]+$/u, '')
    .replace(/[_-]+/gu, ' ')
    .replace(/\s+/gu, ' ')
    .trim() || documentName;
  const yearMatch = `${documentName}\n${text}`.match(/\b(?:19|20)\d{2}\b/u);
  const publicationYear = yearMatch ? Number(yearMatch[0]) : null;
  const url = extractFirstUrl(text);
  return {
    id: `source-${file.name}-${file.lastModified}-${file.size}`,
    sourceName,
    documentName,
    publicationYear,
    url,
    verifiedAt: new Date().toISOString().slice(0, 10),
    metadataStatus: publicationYear && url ? 'complete' : 'incomplete',
  };
}

function extractFirstUrl(value: string): string | null {
  const match = value.match(/https?:\/\/[^\s<>()]+/iu);
  return match?.[0]?.replace(/[.,;:!?]+$/u, '') ?? null;
}

export function getSourceDocumentType(fileName: string): SourceDocumentType | null {
  const extension = fileName.trim().toLowerCase().split('.').pop();
  if (extension === 'docx' || extension === 'pdf' || extension === 'pptx' || extension === 'xlsx') {
    return extension;
  }
  if (extension === 'png' || extension === 'jpg' || extension === 'jpeg' || extension === 'webp') return 'image';
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
    const result = await mammoth.extractRawText({ arrayBuffer: await readFileAsArrayBuffer(file) });
    return result.value;
  }
  if (type === 'pdf') {
    return extractPdfText(file);
  }
  if (type === 'xlsx') {
    return extractXlsxText(file);
  }
  if (type === 'image') {
    return `Visual reference attachment: ${file.name}`;
  }
  return extractPptxText(file);
}

async function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Could not read the selected image attachment.'));
    reader.onload = () => typeof reader.result === 'string'
      ? resolve(reader.result)
      : reject(new Error('Could not read the selected image attachment.'));
    reader.readAsDataURL(file);
  });
}

async function readFileAsArrayBuffer(file: File): Promise<ArrayBuffer> {
  if (typeof file.arrayBuffer === 'function') return file.arrayBuffer();
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Could not read the selected source attachment.'));
    reader.onload = () => reader.result instanceof ArrayBuffer
      ? resolve(reader.result)
      : reject(new Error('Could not read the selected source attachment.'));
    reader.readAsArrayBuffer(file);
  });
}

async function extractPdfText(file: File): Promise<string> {
  const document = await getDocument({ data: new Uint8Array(await readFileAsArrayBuffer(file)) }).promise;
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
  const archive = await JSZip.loadAsync(await readFileAsArrayBuffer(file));
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

async function extractXlsxText(file: File): Promise<string> {
  const archive = await JSZip.loadAsync(await readFileAsArrayBuffer(file));
  const sharedStrings = await getSharedStrings(archive);
  const sheetEntries = Object.values(archive.files)
    .filter((entry) => /^xl\/worksheets\/sheet\d+\.xml$/u.test(entry.name))
    .sort((left, right) => getSheetNumber(left.name) - getSheetNumber(right.name));

  const sheets = await Promise.all(sheetEntries.map(async (entry) => {
    const xml = await entry.async('text');
    const rows = extractWorksheetRows(xml, sharedStrings);
    if (rows.length === 0) return '';
    return `Worksheet ${getSheetNumber(entry.name)}\n${rows.map((row) => row.join(' | ')).join('\n')}`;
  }));
  return sheets.filter(Boolean).join('\n\n');
}

async function getSharedStrings(archive: JSZip): Promise<string[]> {
  const entry = archive.file('xl/sharedStrings.xml');
  if (!entry) return [];
  const xml = await entry.async('text');
  const document = new DOMParser().parseFromString(xml, 'application/xml');
  return Array.from(document.getElementsByTagName('si')).map((item) => Array.from(item.getElementsByTagName('t'))
    .map((node) => node.textContent ?? '')
    .join(''));
}

function extractWorksheetRows(xml: string, sharedStrings: string[]): string[][] {
  const document = new DOMParser().parseFromString(xml, 'application/xml');
  return Array.from(document.getElementsByTagName('row')).map((row) => Array.from(row.getElementsByTagName('c'))
    .map((cell) => getWorksheetCellText(cell, sharedStrings))
    .filter(Boolean));
}

function getWorksheetCellText(cell: Element, sharedStrings: string[]): string {
  const type = cell.getAttribute('t');
  if (type === 'inlineStr') return Array.from(cell.getElementsByTagName('t')).map((node) => node.textContent ?? '').join('');
  const rawValue = cell.getElementsByTagName('v')[0]?.textContent ?? '';
  if (type === 's') return sharedStrings[Number(rawValue)] ?? '';
  return rawValue;
}

function getSlideNumber(path: string): number {
  const match = path.match(/slide(\d+)\.xml$/u);
  return match ? Number(match[1]) : Number.MAX_SAFE_INTEGER;
}

function getSheetNumber(path: string): number {
  const match = path.match(/sheet(\d+)\.xml$/u);
  return match ? Number(match[1]) : Number.MAX_SAFE_INTEGER;
}

function countWorkbookSheets(value: string): number {
  return (value.match(/^Worksheet\s+\d+/gmu) ?? []).length;
}

function extractOpenXmlText(xml: string): string {
  const document = new DOMParser().parseFromString(xml, 'application/xml');
  const textNodes = Array.from(document.getElementsByTagNameNS('http://schemas.openxmlformats.org/drawingml/2006/main', 't'));
  return textNodes.map((node) => node.textContent ?? '').filter(Boolean).join(' ');
}
