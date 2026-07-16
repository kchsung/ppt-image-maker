import { CheckCircle2, Loader2, Sparkles } from 'lucide-react';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { cn } from '@/lib/cn';

interface GenerationProgressPanelProps {
  planStatus: 'idle' | 'loading' | 'succeeded' | 'failed';
  imageStatus: 'idle' | 'loading' | 'succeeded' | 'failed';
  documentStatus: 'idle' | 'loading' | 'succeeded' | 'failed';
}

const steps = [
  {
    id: 'plan',
    title: 'Structuring slides',
    description: 'Reading the source text and preparing slide messages.',
  },
  {
    id: 'image',
    title: 'Generating images',
    description: 'Creating presentation-ready slide images one slide at a time to avoid function timeouts.',
  },
  {
    id: 'document',
    title: 'Preparing PPT',
    description: 'Enhancing notes and export metadata for the final document.',
  },
] as const;

export function GenerationProgressPanel({ planStatus, imageStatus, documentStatus }: GenerationProgressPanelProps) {
  const statusByStep = {
    plan: planStatus,
    image: imageStatus,
    document: documentStatus,
  };

  return (
    <Card>
      <CardHeader>
        <h2 className="text-base font-bold text-primary">Generating your deck</h2>
        <p className="mt-1 text-sm text-text-subtle">
          Keep this page open while the slide images are created. The result will appear automatically.
        </p>
      </CardHeader>
      <CardContent className="space-y-3">
        {steps.map((step) => {
          const status = statusByStep[step.id];
          const isLoading = status === 'loading';
          const isDone = status === 'succeeded';

          return (
            <div
              key={step.id}
              className={cn(
                'flex items-start gap-3 rounded-md border border-border bg-surface px-4 py-3',
                isLoading && 'border-primary bg-primary-muted',
              )}
            >
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
              </div>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
