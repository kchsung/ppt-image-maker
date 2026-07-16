import type {
  GeneratedImageDeck,
  GenerationJob,
  PptDeckPlan,
  PptDocumentEnhancement,
  PptMakerRequest,
} from '@/types/models/pptMaker.model';

export interface PptMakerService {
  generateDeckPlan(request: PptMakerRequest): Promise<PptDeckPlan>;
  createGenerationJob(deckPlan: PptDeckPlan): Promise<GenerationJob | null>;
  generateSlideImages(deckPlan: PptDeckPlan): Promise<GeneratedImageDeck>;
}

export interface PptExportService {
  exportImageDeck(deck: GeneratedImageDeck, fileName?: string, enhancement?: PptDocumentEnhancement): Promise<void>;
}
