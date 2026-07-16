import type { PptExportService } from '@/interfaces/pptMaker.interface';
import type { GeneratedImageDeck, PptDocumentEnhancement } from '@/types/models/pptMaker.model';

const SLIDE_W = 13.333;
const SLIDE_H = 7.5;

export const pptExportService: PptExportService = {
  async exportImageDeck(deck, fileName = 'qlearn-image-deck.pptx', enhancement?: PptDocumentEnhancement) {
    const pptxModule = await import('pptxgenjs');
    const pptx = new pptxModule.default();

    pptx.layout = 'LAYOUT_WIDE';
    pptx.author = 'QLEARN';
    pptx.subject = 'Image-based presentation deck';
    pptx.title = enhancement?.title ?? fileName.replace(/\.pptx$/i, '');
    pptx.company = 'QLEARN';

    const sortedImages = deck.images.slice().sort((left, right) => left.pageNumber - right.pageNumber);
    const imagesWithData = await Promise.all(
      sortedImages.map(async (image) => ({
        ...image,
        imageDataUrl: image.imageDataUrl ?? (image.imageUrl ? await imageUrlToDataUrl(image.imageUrl) : undefined),
      })),
    );

    imagesWithData
      .slice()
      .forEach((image) => {
        if (!image.imageDataUrl) {
          throw new Error(`Slide ${image.pageNumber} does not include image data.`);
        }

        const slide = pptx.addSlide();
        const note = enhancement?.speakerNotes.find((item) => item.pageNumber === image.pageNumber)?.note;
        slide.background = { color: 'FFFFFF' };
        slide.addImage({
          data: image.imageDataUrl,
          x: 0,
          y: 0,
          w: SLIDE_W,
          h: SLIDE_H,
        });
        if (note && 'addNotes' in slide && typeof slide.addNotes === 'function') {
          slide.addNotes(note);
        }
      });

    await pptx.writeFile({ fileName: enhancement?.fileName ?? fileName });
  },
};

async function imageUrlToDataUrl(imageUrl: string): Promise<string> {
  const response = await fetch(imageUrl);
  if (!response.ok) {
    throw new Error(`Failed to load generated slide image: ${response.status}`);
  }

  const blob = await response.blob();
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Failed to convert generated slide image.'));
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        resolve(reader.result);
      } else {
        reject(new Error('Generated slide image conversion returned an invalid result.'));
      }
    };
    reader.readAsDataURL(blob);
  });
}
