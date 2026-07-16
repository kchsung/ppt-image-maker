import { Copy, Layers } from 'lucide-react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import type { PptDeckPlan, SlidePlan } from '@/types/models/pptMaker.model';

interface SlidePlanListProps {
  deckPlan: PptDeckPlan | null;
}

function copyPrompt(slide: SlidePlan) {
  void navigator.clipboard.writeText(slide.imagePrompt);
  toast.success(`Slide ${slide.pageNumber} prompt copied.`);
}

export function SlidePlanList({ deckPlan }: SlidePlanListProps) {
  if (!deckPlan) {
    return (
      <Card className="h-full">
        <CardHeader>
          <h2 className="text-base font-bold text-primary">Generated slide plan</h2>
        </CardHeader>
        <CardContent>
          <div className="flex min-h-80 flex-col items-center justify-center rounded-md border border-dashed border-border bg-surface-muted p-8 text-center">
            <Layers className="mb-3 h-8 w-8 text-text-subtle" />
            <p className="text-sm font-semibold text-text-main">No deck plan yet</p>
            <p className="mt-1 text-sm text-text-subtle">
              Add source text and generate a merge-ready image prompt plan.
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-base font-bold text-primary">{deckPlan.title}</h2>
            <p className="mt-1 text-sm text-text-subtle">{deckPlan.slides.length} slides planned</p>
          </div>
          <Badge>{deckPlan.request.targetLanguage}</Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {deckPlan.slides.map((slide) => (
          <article key={slide.id} className="rounded-md border border-border bg-surface p-4">
            <div className="mb-3 flex items-start justify-between gap-3">
              <div>
                <div className="mb-2 flex flex-wrap items-center gap-2">
                  <Badge>#{slide.pageNumber}</Badge>
                  <Badge className="bg-accent-muted text-accent">{slide.archetype}</Badge>
                </div>
                <h3 className="font-bold text-text-main">{slide.title}</h3>
                <p className="mt-1 text-sm text-text-subtle">{slide.subtitle}</p>
              </div>
              <Button variant="secondary" onClick={() => copyPrompt(slide)} aria-label={`Copy slide ${slide.pageNumber} prompt`}>
                <Copy className="h-4 w-4" />
              </Button>
            </div>
            <p className="text-sm leading-6 text-text-main">{slide.mainMessage}</p>
            <div className="mt-3 flex flex-wrap gap-2">
              {slide.labels.map((label) => (
                <span key={label} className="rounded-md bg-surface-muted px-2 py-1 text-xs font-semibold text-text-subtle">
                  {label}
                </span>
              ))}
            </div>
            <p className="mt-3 border-l-4 border-accent pl-3 text-sm font-semibold text-primary">{slide.takeaway}</p>
          </article>
        ))}
      </CardContent>
    </Card>
  );
}
