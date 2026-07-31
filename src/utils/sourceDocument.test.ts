import { describe, expect, it } from 'vitest';
import JSZip from 'jszip';
import { extractSourceDocument, getSourceDocumentType, normalizeExtractedText } from '@/utils/sourceDocument';

describe('sourceDocument', () => {
  it('recognizes supported source document extensions', () => {
    expect(getSourceDocumentType('lecture.DOCX')).toBe('docx');
    expect(getSourceDocumentType('brief.pdf')).toBe('pdf');
    expect(getSourceDocumentType('existing-deck.pptx')).toBe('pptx');
    expect(getSourceDocumentType('metrics.xlsx')).toBe('xlsx');
    expect(getSourceDocumentType('architecture.png')).toBe('image');
    expect(getSourceDocumentType('notes.txt')).toBeNull();
  });

  it('normalizes extracted document text for slide planning', () => {
    expect(normalizeExtractedText('  First section\r\n\r\n\r\nSecond\t\tsection  ')).toBe('First section\n\nSecond section');
  });

  it('rejects unsupported source files before attempting extraction', async () => {
    const file = new File(['plain text'], 'notes.txt', { type: 'text/plain' });

    await expect(extractSourceDocument(file)).rejects.toThrow('Upload a PDF, DOCX, PPTX, XLSX, PNG, JPEG, or WEBP file.');
  });

  it('extracts spreadsheet values as worksheet rows for planning evidence', async () => {
    const archive = new JSZip();
    archive.file('xl/sharedStrings.xml', '<sst><si><t>Metric</t></si><si><t>Value</t></si><si><t>Adoption</t></si></sst>');
    archive.file('xl/worksheets/sheet1.xml', '<worksheet><sheetData><row r="1"><c r="A1" t="s"><v>0</v></c><c r="B1" t="s"><v>1</v></c></row><row r="2"><c r="A2" t="s"><v>2</v></c><c r="B2"><v>72</v></c></row></sheetData></worksheet>');
    const file = new File([await archive.generateAsync({ type: 'blob' })], 'metrics.xlsx', {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    });

    const extracted = await extractSourceDocument(file);

    expect(extracted.attachment.type).toBe('xlsx');
    expect(extracted.attachment.tableCount).toBe(1);
    expect(extracted.attachment.sourceReference).toEqual(expect.objectContaining({
      documentName: 'metrics.xlsx',
      metadataStatus: 'incomplete',
    }));
    expect(extracted.text).toContain('Worksheet 1');
    expect(extracted.text).toContain('Adoption | 72');
  });

  it('preserves image attachments as vision-ready source material', async () => {
    const file = new File(['image-bytes'], 'reference.png', { type: 'image/png' });
    const extracted = await extractSourceDocument(file);

    expect(extracted.attachment.type).toBe('image');
    expect(extracted.attachment.imageCount).toBe(1);
    expect(extracted.attachment.imageDataUrl).toMatch(/^data:image\/png;base64,/u);
    expect(extracted.attachment.sourceReference?.verifiedAt).toMatch(/^\d{4}-\d{2}-\d{2}$/u);
  });
});
