import { useMemo, useState } from 'react';
import { Download, FileText, Maximize2, PanelTop, X } from 'lucide-react';
import { PptHtmlSlide } from '@/components/pptMaker/PptHtmlSlide';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import type { PptDeckPlan, PptDocumentEnhancement, SlidePlan } from '@/types/models/pptMaker.model';

interface GeneratedPptDeckPanelProps {
  deckPlan: PptDeckPlan | null;
  documentEnhancement: PptDocumentEnhancement | null;
  onExportPptx: () => void;
}

export function GeneratedPptDeckPanel({ deckPlan, documentEnhancement, onExportPptx }: GeneratedPptDeckPanelProps) {
  const slides = useMemo(() => deckPlan?.slides.slice().sort((left, right) => left.pageNumber - right.pageNumber) ?? [], [deckPlan]);
  const [selectedSlideId, setSelectedSlideId] = useState<string | null>(null);
  const [expandedSlide, setExpandedSlide] = useState<SlidePlan | null>(null);
  const selectedSlide = slides.find((slide) => slide.id === selectedSlideId) ?? slides[0] ?? null;
  const canExport = Boolean(deckPlan && documentEnhancement && slides.length > 0);

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-base font-bold text-primary">Editable PPTX preview</h2>
              <p className="mt-1 text-sm text-text-subtle">The preview and exported PPTX share the same Slide JSON and HTML/CSS layout.</p>
            </div>
            <Button disabled={!canExport} onClick={onExportPptx}>
              <Download className="h-4 w-4" />
              Export PPTX
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {!selectedSlide ? (
            <div className="flex min-h-52 flex-col items-center justify-center rounded-md border border-dashed border-border bg-surface-muted p-8 text-center">
              <PanelTop className="mb-3 h-8 w-8 text-text-subtle" />
              <p className="text-sm font-semibold text-text-main">Your Slide JSON preview will appear here</p>
              <p className="mt-1 text-sm text-text-subtle">Create a deck to build content, layouts, and editable PPTX objects.</p>
            </div>
          ) : (
            <div className="space-y-5">
              {deckPlan?.strategy ? (
                <section className="grid gap-3 rounded-md border border-border bg-surface-muted p-4 md:grid-cols-3">
                  <div>
                    <p className="text-xs font-bold uppercase text-accent">Core thesis</p>
                    <p className="mt-1 text-sm font-semibold leading-6 text-text-main">{deckPlan.strategy.coreThesis}</p>
                  </div>
                  <div>
                    <p className="text-xs font-bold uppercase text-accent">Audience need</p>
                    <p className="mt-1 text-sm leading-6 text-text-main">{deckPlan.strategy.audienceNeed}</p>
                  </div>
                  <div>
                    <p className="text-xs font-bold uppercase text-accent">Desired outcome</p>
                    <p className="mt-1 text-sm font-semibold leading-6 text-text-main">{deckPlan.strategy.desiredOutcome}</p>
                  </div>
                </section>
              ) : null}
              <div className="rounded-md border border-border bg-surface-muted px-4 py-3 text-sm text-text-subtle">
                Layout: <span className="font-semibold text-text-main">{selectedSlide.visualStructure}</span>. This deck does not generate a slide image layer; text, cards, connectors, and diagrams are native export targets.
              </div>
              <figure className="overflow-hidden rounded-md border border-border bg-surface">
                <button type="button" className="group relative block w-full overflow-hidden bg-surface-muted text-left" onClick={() => setExpandedSlide(selectedSlide)} aria-label={`Open slide ${selectedSlide.pageNumber} preview`}>
                  <div className="mx-auto w-[min(100%,960px)] overflow-hidden">
                    <PptHtmlSlide slide={selectedSlide} logoImageDataUrl={deckPlan?.request.logoImageDataUrl} styleReference={deckPlan?.request.styleReference} previewScale={0.5} />
                  </div>
                  <span className="absolute right-3 top-3 inline-flex items-center gap-1 rounded-md bg-primary px-2.5 py-1 text-xs font-semibold text-white opacity-90 transition group-hover:opacity-100"><Maximize2 className="h-3.5 w-3.5" />Expand</span>
                </button>
                <figcaption className="flex items-center justify-between gap-2 px-4 py-3 text-sm text-text-subtle"><span className="font-semibold text-text-main">Slide {selectedSlide.pageNumber}</span><span>{selectedSlide.visualStructure}</span></figcaption>
              </figure>
              <div className="flex gap-3 overflow-x-auto pb-2">
                {slides.map((slide) => (
                  <button key={slide.id} type="button" className={['w-[240px] shrink-0 overflow-hidden rounded-md border bg-surface text-left transition', slide.id === selectedSlide.id ? 'border-primary shadow-sm' : 'border-border hover:border-primary'].join(' ')} onClick={() => setSelectedSlideId(slide.id)}>
                    <div className="h-[135px] overflow-hidden"><PptHtmlSlide slide={slide} logoImageDataUrl={deckPlan?.request.logoImageDataUrl} styleReference={deckPlan?.request.styleReference} previewScale={0.125} /></div>
                    <span className="block px-3 py-2 text-xs font-semibold text-text-subtle">Slide {slide.pageNumber} · {slide.visualStructure}</span>
                  </button>
                ))}
              </div>
              {documentEnhancement ? <div className="rounded-md border border-border bg-surface-muted px-4 py-3"><div className="flex items-center gap-2 text-sm font-bold text-primary"><FileText className="h-4 w-4" />{documentEnhancement.title}</div><ul className="mt-2 space-y-1 text-sm text-text-subtle">{documentEnhancement.qaChecklist.slice(0, 3).map((check) => <li key={check}>• {check}</li>)}</ul></div> : null}
            </div>
          )}
        </CardContent>
      </Card>
      {expandedSlide && deckPlan ? <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 p-4" role="dialog" aria-modal="true" aria-label={`Slide ${expandedSlide.pageNumber} preview`}><div className="max-h-full max-w-full overflow-auto rounded-md bg-surface p-3 shadow-xl"><div className="mb-3 flex justify-end"><Button variant="secondary" onClick={() => setExpandedSlide(null)}><X className="h-4 w-4" />Close</Button></div><div className="w-[min(100%,1344px)] overflow-hidden"><PptHtmlSlide slide={expandedSlide} logoImageDataUrl={deckPlan.request.logoImageDataUrl} styleReference={deckPlan.request.styleReference} previewScale={0.7} /></div></div></div> : null}
    </>
  );
}
