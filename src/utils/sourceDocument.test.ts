import { describe, expect, it } from 'vitest';
import { extractSourceDocument, getSourceDocumentType, normalizeExtractedText } from '@/utils/sourceDocument';

describe('sourceDocument', () => {
  it('recognizes supported source document extensions', () => {
    expect(getSourceDocumentType('lecture.DOCX')).toBe('docx');
    expect(getSourceDocumentType('brief.pdf')).toBe('pdf');
    expect(getSourceDocumentType('existing-deck.pptx')).toBe('pptx');
    expect(getSourceDocumentType('notes.txt')).toBeNull();
  });

  it('normalizes extracted document text for slide planning', () => {
    expect(normalizeExtractedText('  First section\r\n\r\n\r\nSecond\t\tsection  ')).toBe('First section\n\nSecond section');
  });

  it('rejects unsupported source files before attempting extraction', async () => {
    const file = new File(['plain text'], 'notes.txt', { type: 'text/plain' });

    await expect(extractSourceDocument(file)).rejects.toThrow('Upload a DOCX, PDF, or PPTX file.');
  });
});
