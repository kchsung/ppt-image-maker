import { PptHtmlSlide } from '@/components/pptMaker/PptHtmlSlide';
import type { PptDeckPlan } from '@/types/models/pptMaker.model';

interface PptDomExportDeckProps {
  deckPlan: PptDeckPlan;
  deckId: string;
}

export function PptDomExportDeck({ deckPlan, deckId }: PptDomExportDeckProps) {
  return (
    <div
      aria-hidden="true"
      data-pptx-deck={deckId}
      style={{ position: 'fixed', left: -22000, top: 0, width: 1920, height: 1080, pointerEvents: 'none', zIndex: -1 }}
    >
      {deckPlan.slides.map((slide) => (
        <PptHtmlSlide key={slide.id} slide={slide} logoImageDataUrl={deckPlan.request.logoImageDataUrl} styleReference={deckPlan.request.styleReference} sourceReferences={deckPlan.request.sourceMaterialAnalysis?.sources} totalSlides={deckPlan.slides.length} exportMode />
      ))}
    </div>
  );
}
