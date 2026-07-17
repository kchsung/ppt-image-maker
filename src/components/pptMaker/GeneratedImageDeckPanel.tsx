import { useMemo, useState } from 'react';
import { Download, FileText, Image, Maximize2, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import type { GeneratedImageDeck, GeneratedSlideImage, PptDocumentEnhancement } from '@/types/models/pptMaker.model';

interface GeneratedImageDeckPanelProps {
  imageDeck: GeneratedImageDeck | null;
  documentEnhancement: PptDocumentEnhancement | null;
  onExportPptx: () => void;
}

export function GeneratedImageDeckPanel({
  imageDeck,
  documentEnhancement,
  onExportPptx,
}: GeneratedImageDeckPanelProps) {
  const [selectedSlideId, setSelectedSlideId] = useState<string | null>(null);
  const [expandedSlide, setExpandedSlide] = useState<GeneratedSlideImage | null>(null);
  const canExport = Boolean(imageDeck);
  const sortedImages = useMemo(
    () => imageDeck?.images.slice().sort((left, right) => left.pageNumber - right.pageNumber) ?? [],
    [imageDeck],
  );
  const selectedSlide =
    sortedImages.find((image) => image.id === selectedSlideId) ?? sortedImages[0] ?? null;

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-base font-bold text-primary">Generated slide preview</h2>
              <p className="mt-1 text-sm text-text-subtle">
                Review slide visuals at a larger size. Exported PPTX text is editable in PowerPoint.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button disabled={!canExport} onClick={onExportPptx}>
                <Download className="h-4 w-4" />
                Export PPTX
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {!imageDeck || !selectedSlide ? (
            <div className="flex min-h-52 flex-col items-center justify-center rounded-md border border-dashed border-border bg-surface-muted p-8 text-center">
              <Image className="mb-3 h-8 w-8 text-text-subtle" />
              <p className="text-sm font-semibold text-text-main">Generated images will appear here</p>
              <p className="mt-1 text-sm text-text-subtle">
                Submit source text with a template or uploaded style image to start generation.
              </p>
            </div>
          ) : (
            <div className="space-y-5">
              <figure className="overflow-hidden rounded-md border border-border bg-surface">
                <button
                  type="button"
                  className="group relative block w-full bg-surface-muted text-left"
                  onClick={() => setExpandedSlide(selectedSlide)}
                  aria-label={`Open slide ${selectedSlide.pageNumber} preview`}
                >
                  <img
                    src={selectedSlide.imageDataUrl ?? selectedSlide.imageUrl}
                    alt={`Generated slide ${selectedSlide.pageNumber}`}
                    className="aspect-video w-full object-contain"
                  />
                  <span className="absolute right-3 top-3 inline-flex items-center gap-1 rounded-md bg-primary px-2.5 py-1 text-xs font-semibold text-white opacity-90 transition group-hover:opacity-100">
                    <Maximize2 className="h-3.5 w-3.5" />
                    Expand
                  </span>
                </button>
                <figcaption className="flex items-center justify-between gap-2 px-4 py-3 text-sm text-text-subtle">
                  <span className="font-semibold text-text-main">Slide {selectedSlide.pageNumber}</span>
                  <span>{selectedSlide.provider}</span>
                </figcaption>
              </figure>

              <div className="flex gap-3 overflow-x-auto pb-2">
                {sortedImages.map((image) => {
                  const isSelected = image.id === selectedSlide.id;
                  return (
                    <button
                      key={image.id}
                      type="button"
                      className={[
                        'w-52 shrink-0 overflow-hidden rounded-md border bg-surface text-left transition',
                        isSelected ? 'border-primary shadow-sm' : 'border-border hover:border-primary',
                      ].join(' ')}
                      onClick={() => setSelectedSlideId(image.id)}
                    >
                      <img
                        src={image.imageDataUrl ?? image.imageUrl}
                        alt={`Generated slide thumbnail ${image.pageNumber}`}
                        className="aspect-video w-full object-cover"
                      />
                      <span className="block px-3 py-2 text-xs font-semibold text-text-subtle">
                        Slide {image.pageNumber}
                      </span>
                    </button>
                  );
                })}
              </div>

              {documentEnhancement ? (
                <div className="rounded-md border border-border bg-surface-muted p-4">
                  <div className="mb-3 flex items-center gap-2 text-sm font-bold text-primary">
                    <FileText className="h-4 w-4" />
                    {documentEnhancement.title}
                  </div>
                  <p className="text-sm text-text-subtle">Output file: {documentEnhancement.fileName}</p>
                  <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-text-subtle">
                    {documentEnhancement.qaChecklist.map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </div>
          )}
        </CardContent>
      </Card>

      {expandedSlide ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4">
          <div className="max-h-full w-full max-w-6xl overflow-hidden rounded-md bg-surface shadow-xl">
            <div className="flex items-center justify-between border-b border-border px-4 py-3">
              <p className="text-sm font-bold text-primary">Slide {expandedSlide.pageNumber}</p>
              <Button variant="ghost" className="h-8 px-2" onClick={() => setExpandedSlide(null)}>
                <X className="h-4 w-4" />
                Close
              </Button>
            </div>
            <div className="bg-surface-muted p-3">
              <img
                src={expandedSlide.imageDataUrl ?? expandedSlide.imageUrl}
                alt={`Expanded generated slide ${expandedSlide.pageNumber}`}
                className="max-h-[78vh] w-full object-contain"
              />
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
