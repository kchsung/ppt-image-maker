import { useMemo, useState, type ReactNode } from 'react';
import { CheckCircle2, Download, Eye, FileText, Image, Loader2, Sparkles, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { cn } from '@/lib/cn';
import type { GeneratedImageDeck, PptDeckPlan, PptDocumentEnhancement } from '@/types/models/pptMaker.model';

interface GenerationProgressPanelProps {
  planStatus: 'idle' | 'loading' | 'succeeded' | 'failed';
  imageStatus: 'idle' | 'loading' | 'succeeded' | 'failed';
  documentStatus: 'idle' | 'loading' | 'succeeded' | 'failed';
  deckPlan: PptDeckPlan | null;
  imageDeck: GeneratedImageDeck | null;
  documentEnhancement: PptDocumentEnhancement | null;
}

type StepId = 'plan' | 'image' | 'document';

const steps = [
  {
    id: 'plan',
    title: 'Structuring slides',
    description: 'Claude is creating and validating the final slide copy before image generation.',
  },
  {
    id: 'image',
    title: 'Generating images',
    description: 'Creating presentation-ready slide images one slide at a time to avoid function timeouts.',
  },
  {
    id: 'document',
    title: 'Preparing PPT',
    description: 'Claude is separating editable text from visual layers and preparing slide-specific PPT layouts.',
  },
] as const satisfies Array<{ id: StepId; title: string; description: string }>;

export function GenerationProgressPanel({
  planStatus,
  imageStatus,
  documentStatus,
  deckPlan,
  imageDeck,
  documentEnhancement,
}: GenerationProgressPanelProps) {
  const [detailStep, setDetailStep] = useState<StepId | null>(null);
  const sortedImages = useMemo(
    () => imageDeck?.images.slice().sort((left, right) => left.pageNumber - right.pageNumber) ?? [],
    [imageDeck],
  );
  const totalSlides = deckPlan?.slides.length ?? 0;
  const generatedCount = sortedImages.length;
  const statusByStep = {
    plan: planStatus,
    image: imageStatus,
    document: documentStatus,
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h2 className="text-base font-bold text-primary">Generating your deck</h2>
            <p className="mt-1 text-sm text-text-subtle">
              Keep this page open while the slide images are created. The export button appears when generation finishes.
            </p>
          </div>
          <Button variant="secondary" disabled>
            <Download className="h-4 w-4" />
            Export after completion
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {steps.map((step) => {
          const status = statusByStep[step.id];
          const isLoading = status === 'loading';
          const isDone = status === 'succeeded';
          const progressText =
            step.id === 'image' && totalSlides > 0
              ? `${generatedCount}/${totalSlides} images generated`
              : step.id === 'plan' && deckPlan
                ? `${deckPlan.slides.length} slides structured and copy QA passed`
                : step.id === 'document' && documentEnhancement
                  ? `${documentEnhancement.layouts.length} editable slide layouts ready`
                  : null;

          return (
            <div
              key={step.id}
              className={cn(
                'flex flex-col gap-3 rounded-md border border-border bg-surface px-4 py-3 sm:flex-row sm:items-start sm:justify-between',
                isLoading && 'border-primary bg-primary-muted',
              )}
            >
              <div className="flex items-start gap-3">
                <div className="mt-0.5">
                  {isDone ? (
                    <CheckCircle2 className="h-5 w-5 text-success" />
                  ) : isLoading ? (
                    <Loader2 className="h-5 w-5 animate-spin text-primary" />
                  ) : (
                    <Sparkles className="h-5 w-5 text-text-subtle" />
                  )}
                </div>
                <div>
                  <p className="text-sm font-bold text-text-main">{step.title}</p>
                  <p className="mt-1 text-sm text-text-subtle">{step.description}</p>
                  {progressText ? <p className="mt-2 text-xs font-semibold text-primary">{progressText}</p> : null}
                </div>
              </div>
              <Button variant="secondary" className="h-8 self-start px-3 text-xs" onClick={() => setDetailStep(step.id)}>
                <Eye className="h-3.5 w-3.5" />
                Details
              </Button>
            </div>
          );
        })}
      </CardContent>

      {detailStep ? (
        <GenerationDetailDrawer
          activeStep={detailStep}
          deckPlan={deckPlan}
          documentEnhancement={documentEnhancement}
          generatedCount={generatedCount}
          imageDeck={imageDeck}
          onClose={() => setDetailStep(null)}
          sortedImages={sortedImages}
          totalSlides={totalSlides}
        />
      ) : null}
    </Card>
  );
}

interface GenerationDetailDrawerProps {
  activeStep: StepId;
  deckPlan: PptDeckPlan | null;
  imageDeck: GeneratedImageDeck | null;
  documentEnhancement: PptDocumentEnhancement | null;
  generatedCount: number;
  totalSlides: number;
  sortedImages: NonNullable<GeneratedImageDeck['images']>;
  onClose: () => void;
}

function GenerationDetailDrawer({
  activeStep,
  deckPlan,
  documentEnhancement,
  generatedCount,
  imageDeck,
  onClose,
  sortedImages,
  totalSlides,
}: GenerationDetailDrawerProps) {
  const activeMeta = steps.find((step) => step.id === activeStep);

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/30">
      <button type="button" className="flex-1 cursor-default" aria-label="Close details" onClick={onClose} />
      <aside className="h-full w-full max-w-xl overflow-y-auto border-l border-border bg-surface shadow-xl">
        <div className="sticky top-0 z-10 flex items-start justify-between gap-3 border-b border-border bg-surface px-5 py-4">
          <div>
            <p className="text-xs font-bold uppercase tracking-wide text-accent">Generation detail</p>
            <h3 className="mt-1 text-lg font-bold text-primary">{activeMeta?.title}</h3>
            <p className="mt-1 text-sm text-text-subtle">{activeMeta?.description}</p>
          </div>
          <Button variant="ghost" className="h-8 px-2" onClick={onClose}>
            <X className="h-4 w-4" />
            Close
          </Button>
        </div>

        <div className="space-y-4 p-5">
          {activeStep === 'plan' ? <DeckPlanDetail deckPlan={deckPlan} /> : null}
          {activeStep === 'image' ? (
            <ImageGenerationDetail
              generatedCount={generatedCount}
              imageDeck={imageDeck}
              sortedImages={sortedImages}
              totalSlides={totalSlides}
            />
          ) : null}
          {activeStep === 'document' ? <DocumentDetail documentEnhancement={documentEnhancement} /> : null}
        </div>
      </aside>
    </div>
  );
}

function DeckPlanDetail({ deckPlan }: { deckPlan: PptDeckPlan | null }) {
  if (!deckPlan) {
    return (
      <EmptyDetail
        icon={<FileText className="h-7 w-7 text-text-subtle" />}
        title="Slide messages are being prepared"
        description="The structured slide plan will appear here as soon as the source text is parsed."
      />
    );
  }

  return (
    <>
      <div className="rounded-md border border-border bg-surface-muted p-4">
        <p className="text-sm font-bold text-primary">{deckPlan.title}</p>
        <p className="mt-1 text-sm text-text-subtle">
          {deckPlan.slides.length} slides · {deckPlan.request.targetLanguage} · {deckPlan.request.purpose}
        </p>
        <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-text-subtle">
          {deckPlan.copyQa.checks.map((check) => (
            <li key={check}>{check}</li>
          ))}
        </ul>
      </div>
      <div className="space-y-3">
        {deckPlan.slides.map((slide) => (
          <article key={slide.id} className="rounded-md border border-border bg-surface p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs font-bold uppercase tracking-wide text-text-subtle">Slide {slide.pageNumber}</p>
                <h4 className="mt-1 text-sm font-bold text-primary">{slide.title}</h4>
              </div>
              <span className="rounded-full bg-primary-muted px-2 py-1 text-xs font-semibold text-primary">
                {slide.visualStructure}
              </span>
            </div>
            <p className="mt-2 text-sm text-text-subtle">{slide.subtitle}</p>
            <p className="mt-3 text-sm leading-6 text-text-main">{slide.mainMessage}</p>
            <div className="mt-3 flex flex-wrap gap-2">
              {slide.labels.map((label) => (
                <span key={label} className="rounded-full border border-border px-2.5 py-1 text-xs font-semibold text-text-subtle">
                  {label}
                </span>
              ))}
            </div>
            <p className="mt-3 border-l-4 border-accent pl-3 text-sm font-semibold text-primary">{slide.takeaway}</p>
          </article>
        ))}
      </div>
    </>
  );
}

function ImageGenerationDetail({
  generatedCount,
  imageDeck,
  sortedImages,
  totalSlides,
}: {
  generatedCount: number;
  imageDeck: GeneratedImageDeck | null;
  sortedImages: NonNullable<GeneratedImageDeck['images']>;
  totalSlides: number;
}) {
  return (
    <>
      <div className="rounded-md border border-border bg-surface-muted p-4">
        <p className="text-sm font-bold text-primary">
          {generatedCount}/{totalSlides || imageDeck?.images.length || 0} images generated
        </p>
        <div className="mt-3 h-2 overflow-hidden rounded-full bg-border">
          <div
            className="h-full rounded-full bg-primary transition-all"
            style={{ width: `${totalSlides > 0 ? Math.round((generatedCount / totalSlides) * 100) : 0}%` }}
          />
        </div>
      </div>

      {sortedImages.length === 0 ? (
        <EmptyDetail
          icon={<Image className="h-7 w-7 text-text-subtle" />}
          title="No images have finished yet"
          description="Generated slide previews will appear here one by one."
        />
      ) : (
        <div className="grid gap-3">
          {sortedImages.map((image) => (
            <figure key={image.id} className="overflow-hidden rounded-md border border-border bg-surface">
              <img
                src={image.imageDataUrl ?? image.imageUrl}
                alt={`Generated slide ${image.pageNumber}`}
                className="aspect-video w-full object-contain"
              />
              <figcaption className="flex items-center justify-between gap-2 px-3 py-2 text-xs text-text-subtle">
                <span className="font-semibold text-text-main">Slide {image.pageNumber}</span>
                <span>{image.provider}</span>
              </figcaption>
            </figure>
          ))}
        </div>
      )}
    </>
  );
}

function DocumentDetail({ documentEnhancement }: { documentEnhancement: PptDocumentEnhancement | null }) {
  if (!documentEnhancement) {
    return (
      <EmptyDetail
        icon={<Download className="h-7 w-7 text-text-subtle" />}
        title="PPT output is not ready yet"
        description="After image generation finishes, Claude prepares editable slide layouts. The Export PPTX button appears on the final output screen."
      />
    );
  }

  return (
    <div className="rounded-md border border-border bg-surface-muted p-4">
      <p className="text-sm font-bold text-primary">{documentEnhancement.title}</p>
      <p className="mt-1 text-sm text-text-subtle">Output file: {documentEnhancement.fileName}</p>
      <p className="mt-1 text-sm text-text-subtle">
        Editable layout source: {documentEnhancement.layoutSource === 'claude' ? 'Claude' : 'local fallback'}
      </p>
      <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-text-subtle">
        {documentEnhancement.qaChecklist.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
    </div>
  );
}

function EmptyDetail({
  description,
  icon,
  title,
}: {
  description: string;
  icon: ReactNode;
  title: string;
}) {
  return (
    <div className="flex min-h-52 flex-col items-center justify-center rounded-md border border-dashed border-border bg-surface-muted p-8 text-center">
      {icon}
      <p className="mt-3 text-sm font-semibold text-text-main">{title}</p>
      <p className="mt-1 text-sm text-text-subtle">{description}</p>
    </div>
  );
}
