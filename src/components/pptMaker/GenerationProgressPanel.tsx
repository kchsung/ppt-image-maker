import { useState, type ReactNode } from 'react';
import { CheckCircle2, Download, Eye, FileText, LayoutTemplate, Loader2, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { cn } from '@/lib/cn';
import type { PptDeckPlan, PptDocumentEnhancement } from '@/types/models/pptMaker.model';

interface GenerationProgressPanelProps {
  planStatus: 'idle' | 'loading' | 'succeeded' | 'failed';
  documentStatus: 'idle' | 'loading' | 'succeeded' | 'failed';
  deckPlan: PptDeckPlan | null;
  documentEnhancement: PptDocumentEnhancement | null;
}

type StepId = 'plan' | 'layout' | 'document';

const steps = [
  { id: 'plan', title: 'Structuring slides', description: 'OpenAI is creating and validating the storyline, slide copy, data fields, and visual structure.' },
  { id: 'layout', title: 'Designing layouts', description: 'The layout engine maps the approved Slide JSON to varied HTML/CSS slide structures.' },
  { id: 'document', title: 'Preparing editable PPT', description: 'The same HTML/CSS will be converted to editable PPTX objects by dom-to-pptx when you export.' },
] as const satisfies Array<{ id: StepId; title: string; description: string }>;

export function GenerationProgressPanel({ planStatus, documentStatus, deckPlan, documentEnhancement }: GenerationProgressPanelProps) {
  const [detailStep, setDetailStep] = useState<StepId | null>(null);
  const layoutStatus = documentStatus === 'loading' ? 'loading' : documentEnhancement ? 'succeeded' : planStatus === 'succeeded' ? 'loading' : 'idle';
  const statusByStep = { plan: planStatus, layout: layoutStatus, document: documentStatus } as const;

  return <Card><CardHeader><div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between"><div><h2 className="text-base font-bold text-primary">Generating your deck</h2><p className="mt-1 text-sm text-text-subtle">Slide copy and layout are generated first. No slide image layer is created in this workflow.</p></div><Button variant="secondary" disabled><Download className="h-4 w-4" />Export after completion</Button></div></CardHeader><CardContent className="space-y-3">{steps.map((step) => { const status = statusByStep[step.id]; const done = status === 'succeeded'; const loading = status === 'loading'; const progress = step.id === 'plan' && deckPlan ? `${deckPlan.slides.length} slides structured and copy QA passed` : step.id === 'layout' && deckPlan ? `${new Set(deckPlan.slides.map((slide) => slide.visualStructure)).size} visual structures selected` : step.id === 'document' && documentEnhancement ? `${documentEnhancement.layouts.length} editable slide layouts ready` : null; return <div key={step.id} className={cn('flex flex-col gap-3 rounded-md border border-border bg-surface px-4 py-3 sm:flex-row sm:items-start sm:justify-between', loading && 'border-primary bg-primary-muted')}><div className="flex items-start gap-3"><div className="mt-0.5">{done ? <CheckCircle2 className="h-5 w-5 text-success" /> : loading ? <Loader2 className="h-5 w-5 animate-spin text-primary" /> : <LayoutTemplate className="h-5 w-5 text-text-subtle" />}</div><div><p className="text-sm font-bold text-text-main">{step.title}</p><p className="mt-1 text-sm text-text-subtle">{step.description}</p>{progress ? <p className="mt-2 text-xs font-semibold text-primary">{progress}</p> : null}</div></div><Button variant="secondary" className="h-8 self-start px-3 text-xs" onClick={() => setDetailStep(step.id)}><Eye className="h-3.5 w-3.5" />Details</Button></div>; })}</CardContent>{detailStep ? <GenerationDetailDrawer activeStep={detailStep} deckPlan={deckPlan} documentEnhancement={documentEnhancement} onClose={() => setDetailStep(null)} /> : null}</Card>;
}

function GenerationDetailDrawer({ activeStep, deckPlan, documentEnhancement, onClose }: { activeStep: StepId; deckPlan: PptDeckPlan | null; documentEnhancement: PptDocumentEnhancement | null; onClose: () => void }) {
  const meta = steps.find((step) => step.id === activeStep);
  return <div className="fixed inset-0 z-50 flex justify-end bg-black/30"><button type="button" className="flex-1 cursor-default" aria-label="Close details" onClick={onClose} /><aside className="h-full w-full max-w-xl overflow-y-auto border-l border-border bg-surface shadow-xl"><div className="sticky top-0 z-10 flex items-start justify-between gap-3 border-b border-border bg-surface px-5 py-4"><div><p className="text-xs font-bold uppercase tracking-wide text-accent">Generation detail</p><h3 className="mt-1 text-lg font-bold text-primary">{meta?.title}</h3><p className="mt-1 text-sm text-text-subtle">{meta?.description}</p></div><Button variant="ghost" className="h-8 px-2" onClick={onClose}><X className="h-4 w-4" />Close</Button></div><div className="space-y-4 p-5">{activeStep === 'plan' ? <DeckPlanDetail deckPlan={deckPlan} /> : null}{activeStep === 'layout' ? <LayoutDetail deckPlan={deckPlan} /> : null}{activeStep === 'document' ? <DocumentDetail documentEnhancement={documentEnhancement} /> : null}</div></aside></div>;
}

function DeckPlanDetail({ deckPlan }: { deckPlan: PptDeckPlan | null }) {
  if (!deckPlan) return <EmptyDetail icon={<FileText className="h-7 w-7 text-text-subtle" />} title="Slide messages are being prepared" description="The structured Slide JSON will appear after the source is parsed." />;
  return <div className="space-y-3">
    {deckPlan.strategy ? <section className="rounded-md border border-border bg-surface-muted p-4"><p className="text-xs font-bold uppercase tracking-wide text-accent">Deck strategy</p><p className="mt-2 text-sm font-bold leading-6 text-primary">{deckPlan.strategy.coreThesis}</p><p className="mt-2 text-sm leading-6 text-text-subtle">{deckPlan.strategy.audienceNeed}</p><p className="mt-2 text-sm font-semibold leading-6 text-text-main">{deckPlan.strategy.desiredOutcome}</p></section> : null}
    {deckPlan.slides.map((slide) => {
      const contentBlocks = slide.contentBlocks ?? slide.labels.map((heading) => ({ heading, detail: slide.mainMessage }));
      const objective = slide.objective || slide.subtitle;
      const decision = slide.decision || slide.takeaway;

      return <article key={slide.id} className="rounded-md border border-border bg-surface p-4"><p className="text-xs font-bold uppercase tracking-wide text-text-subtle">Slide {slide.pageNumber} - {slide.visualStructure}</p><h4 className="mt-1 text-sm font-bold text-primary">{slide.title}</h4><p className="mt-2 text-sm font-semibold text-text-main">{objective}</p><p className="mt-2 text-sm text-text-subtle">{slide.mainMessage}</p><div className="mt-3 space-y-2">{contentBlocks.map((block) => <div key={block.heading} className="rounded-md border border-border bg-surface-muted p-3"><p className="text-xs font-bold text-primary">{block.heading}</p><p className="mt-1 text-xs leading-5 text-text-subtle">{block.detail}</p></div>)}</div><p className="mt-3 border-l-4 border-accent pl-3 text-sm font-semibold text-primary">{decision}</p></article>;
    })}
  </div>;
}

function LayoutDetail({ deckPlan }: { deckPlan: PptDeckPlan | null }) {
  if (!deckPlan) return <EmptyDetail icon={<LayoutTemplate className="h-7 w-7 text-text-subtle" />} title="Layouts are waiting for copy" description="Each slide receives an HTML/CSS structure after copy planning completes." />;
  return <div className="rounded-md border border-border bg-surface-muted p-4"><p className="text-sm font-bold text-primary">Structure coverage</p><div className="mt-3 grid gap-2">{deckPlan.slides.map((slide) => <div key={slide.id} className="flex items-center justify-between rounded-md border border-border bg-surface px-3 py-2 text-sm"><span>Slide {slide.pageNumber}</span><span className="font-semibold text-primary">{slide.visualStructure}</span></div>)}</div></div>;
}

function DocumentDetail({ documentEnhancement }: { documentEnhancement: PptDocumentEnhancement | null }) {
  if (!documentEnhancement) return <EmptyDetail icon={<Download className="h-7 w-7 text-text-subtle" />} title="PPT output is not ready yet" description="After layout design finishes, export uses dom-to-pptx and falls back to PptxGenJS only when DOM conversion is unavailable." />;
  return <div className="rounded-md border border-border bg-surface-muted p-4"><p className="text-sm font-bold text-primary">{documentEnhancement.title}</p><p className="mt-1 text-sm text-text-subtle">Output file: {documentEnhancement.fileName}</p><p className="mt-1 text-sm text-text-subtle">Editable layout source: HTML/CSS + dom-to-pptx</p><ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-text-subtle">{documentEnhancement.qaChecklist.map((item) => <li key={item}>{item}</li>)}</ul></div>;
}

function EmptyDetail({ description, icon, title }: { description: string; icon: ReactNode; title: string }) {
  return <div className="flex min-h-52 flex-col items-center justify-center rounded-md border border-dashed border-border bg-surface-muted p-8 text-center">{icon}<p className="mt-3 text-sm font-semibold text-text-main">{title}</p><p className="mt-1 text-sm text-text-subtle">{description}</p></div>;
}
