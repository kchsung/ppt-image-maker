import { Download, FileText, Image } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import type { GeneratedImageDeck, PptDocumentEnhancement } from '@/types/models/pptMaker.model';

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
  const canExport = Boolean(imageDeck);

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-base font-bold text-primary">Generated slide images</h2>
            <p className="mt-1 text-sm text-text-subtle">
              Review the generated slide images and export them as a full-bleed PPTX document.
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
        {!imageDeck ? (
          <div className="flex min-h-52 flex-col items-center justify-center rounded-md border border-dashed border-border bg-surface-muted p-8 text-center">
            <Image className="mb-3 h-8 w-8 text-text-subtle" />
            <p className="text-sm font-semibold text-text-main">Generated images will appear here</p>
            <p className="mt-1 text-sm text-text-subtle">Submit source text with a template or uploaded style image to start generation.</p>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {imageDeck.images.map((image) => (
                <figure key={image.id} className="overflow-hidden rounded-md border border-border bg-surface">
                  <img
                    src={image.imageDataUrl ?? image.imageUrl}
                    alt={`Generated slide ${image.pageNumber}`}
                    className="aspect-video w-full object-cover"
                  />
                  <figcaption className="flex items-center justify-between gap-2 px-3 py-2 text-xs text-text-subtle">
                    <span>Slide {image.pageNumber}</span>
                    <span>{image.provider}</span>
                  </figcaption>
                </figure>
              ))}
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
  );
}
