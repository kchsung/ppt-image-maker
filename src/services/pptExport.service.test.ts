import { describe, expect, it } from 'vitest';
import JSZip from 'jszip';
import { samplePptMakerRequest } from '@/mocks/pptMaker.mock';
import { enhancePptDocument } from '@/services/pptDocument.service';
import { pptExportService } from '@/services/pptExport.service';
import { pptMakerService } from '@/services/pptMaker.service';

describe('pptExportService', () => {
  it('exports editable layout blocks into a PPTX blob through the PptxGenJS fallback', async () => {
    const deckPlan = await pptMakerService.generateDeckPlan({ ...samplePptMakerRequest, slideCount: 6 });
    const enhancement = await enhancePptDocument(deckPlan);

    const blob = await pptExportService.createDeckBlob(deckPlan, enhancement);

    expect(['application/zip', 'application/vnd.openxmlformats-officedocument.presentationml.presentation']).toContain(blob.type);
    expect(blob.size).toBeGreaterThan(1000);

    const archive = await JSZip.loadAsync(await readBlobAsArrayBuffer(blob));
    const slideFiles = Object.keys(archive.files).filter((name) => /^ppt\/slides\/slide\d+\.xml$/u.test(name));
    const slideXml = await Promise.all(slideFiles.map(async (name) => archive.file(name)?.async('string') ?? ''));
    const presentationXml = slideXml.join('\n');
    const presentationText = slideXml
      .flatMap((xml) => [...xml.matchAll(/<a:t>([\s\S]*?)<\/a:t>/gu)].map((match) => decodeXmlEntities(match[1])))
      .join('\n');
    const expectedEditableCopy = enhancement.layouts
      .flatMap((layout) => layout.textBlocks.map((block) => block.text))
      .filter(Boolean);

    expect(slideFiles).toHaveLength(deckPlan.slides.length + 1);
    expect(presentationXml).toContain('Pretendard');
    expectedEditableCopy.forEach((text) => {
      text.split(/\r?\n/u).filter(Boolean).forEach((line) => {
        expect(presentationText).toContain(line);
      });
    });
  });
});

function decodeXmlEntities(value: string): string {
  return value
    .replace(/&amp;/gu, '&')
    .replace(/&lt;/gu, '<')
    .replace(/&gt;/gu, '>')
    .replace(/&quot;/gu, '"')
    .replace(/&apos;/gu, "'");
}

function readBlobAsArrayBuffer(blob: Blob): Promise<ArrayBuffer> {
  if ('arrayBuffer' in blob && typeof blob.arrayBuffer === 'function') {
    return blob.arrayBuffer();
  }

  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as ArrayBuffer);
    reader.onerror = () => reject(reader.error ?? new Error('Unable to read PPTX blob.'));
    reader.readAsArrayBuffer(blob);
  });
}
