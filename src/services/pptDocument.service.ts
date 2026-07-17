import { supabase } from '@/lib/supabase';
import type { GeneratedImageDeck, PptDocumentEnhancement } from '@/types/models/pptMaker.model';
import { getSupabaseFunctionErrorMessage } from '@/utils/supabaseFunctionError';

export async function enhancePptDocument(imageDeck: GeneratedImageDeck): Promise<PptDocumentEnhancement> {
  if (supabase) {
    const { data, error } = await supabase.functions.invoke<PptDocumentEnhancement>('enhance-ppt-document', {
      body: { imageDeck },
    });

    if (error) {
      console.warn('PPT document enhancement failed. Falling back to local metadata.', await getSupabaseFunctionErrorMessage(error));
      return createFallbackEnhancement(imageDeck);
    }

    if (!data) {
      return createFallbackEnhancement(imageDeck);
    }

    return data;
  }

  return createFallbackEnhancement(imageDeck);
}

function createFallbackEnhancement(imageDeck: GeneratedImageDeck): PptDocumentEnhancement {
  return {
    title: imageDeck.images[0]?.title ?? 'QLEARN Image Deck',
    fileName: 'qlearn-editable-deck.pptx',
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
