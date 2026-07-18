import type {
  GeneratedImageDeck,
  GenerationJob,
  PptDeckPlan,
  PptDocumentEnhancement,
  PptMakerRequest,
  GeneratedSlideImage,
} from '@/types/models/pptMaker.model';

export interface PptMakerService {
  generateDeckPlan(request: PptMakerRequest): Promise<PptDeckPlan>;
  createGenerationJob(deckPlan: PptDeckPlan): Promise<GenerationJob | null>;
  generateSlideImages(
    deckPlan: PptDeckPlan,
    onSlideGenerated?: (image: GeneratedSlideImage) => void,
  ): Promise<GeneratedImageDeck>;
}

export interface PptExportService {
  exportImageDeck(
    deck: GeneratedImageDeck,
    deckPlan?: PptDeckPlan | null,
    fileName?: string,
    enhancement?: PptDocumentEnhancement,
  ): Promise<void>;
  createImageDeckBlob(
    deck: GeneratedImageDeck,
    deckPlan?: PptDeckPlan | null,
    enhancement?: PptDocumentEnhancement,
  ): Promise<Blob>;
}
