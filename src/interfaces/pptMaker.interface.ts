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
  exportDeck(
    deckPlan: PptDeckPlan,
    enhancement: PptDocumentEnhancement,
    slideElements: HTMLElement[],
  ): Promise<void>;
  createDeckBlob(
    deckPlan: PptDeckPlan,
    enhancement: PptDocumentEnhancement,
    slideElements?: HTMLElement[],
  ): Promise<Blob>;
}
