import type {
  GeneratedImageDeck,
  PptDeckPlan,
  PptDocumentEnhancement,
  PptMakerRequest,
} from '@/types/models/pptMaker.model';

export interface PptMakerService {
  generateDeckPlan(request: PptMakerRequest): Promise<PptDeckPlan>;
  generateSlideImages(deckPlan: PptDeckPlan): Promise<GeneratedImageDeck>;
}

export interface PptExportService {
  exportImageDeck(deck: GeneratedImageDeck, fileName?: string, enhancement?: PptDocumentEnhancement): Promise<void>;
}
