import { supabase } from '@/lib/supabase';
import type { GeneratedImageDeck, PptDocumentEnhancement } from '@/types/models/pptMaker.model';

export async function enhancePptDocument(imageDeck: GeneratedImageDeck): Promise<PptDocumentEnhancement> {
  if (supabase) {
    const { data, error } = await supabase.functions.invoke<PptDocumentEnhancement>('enhance-ppt-document', {
      body: { imageDeck },
    });

    if (error) {
      throw new Error(error.message);
    }

    if (!data) {
      throw new Error('No PPT document enhancement returned from Edge Function.');
    }

    return data;
  }

  return {
    title: imageDeck.images[0]?.title ?? 'QLEARN Image Deck',
    fileName: 'qlearn-image-deck.pptx',
    speakerNotes: imageDeck.images.map((image) => ({
      pageNumber: image.pageNumber,
      note: `Explain the key message of "${image.title}" and connect it to the next slide.`,
    })),
    qaChecklist: [
      'Confirm page numbers match the source order.',
      'Check text legibility on every generated image.',
      'Verify the sample style is consistent across all slides.',
    ],
  };
}
