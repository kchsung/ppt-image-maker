import { useMemo, useState } from 'react';
import { Download, ExternalLink, FileText, Maximize2, PanelTop, X } from 'lucide-react';
import { PptHtmlSlide } from '@/components/pptMaker/PptHtmlSlide';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import type {
  PptDeckPlan,
  PptDocumentEnhancement,
  PptCoverageSuggestion,
  PptRedundancySuggestion,
  SlidePlan,
  SlideRole,
  TargetLanguage,
} from '@/types/models/pptMaker.model';

interface GeneratedPptDeckPanelProps {
  deckPlan: PptDeckPlan | null;
  documentEnhancement: PptDocumentEnhancement | null;
  onExportPptx: () => void;
}

const slideRoleLabels: Record<SlideRole, Record<TargetLanguage, string>> = {
  opening: { English: 'Opening', Korean: '도입' },
  context: { English: 'Context', Korean: '맥락 제시' },
  'problem-framing': { English: 'Problem framing', Korean: '문제 제기' },
  evidence: { English: 'Evidence', Korean: '근거 제시' },
  comparison: { English: 'Comparison', Korean: '비교' },
  solution: { English: 'Solution', Korean: '해결방안' },
  implementation: { English: 'Implementation', Korean: '실행방안' },
  'case-study': { English: 'Case study', Korean: '사례' },
  decision: { English: 'Decision', Korean: '의사결정' },
  conclusion: { English: 'Conclusion', Korean: '결론' },
};

function getSlideRoleLabel(slide: SlidePlan, language: TargetLanguage): string {
  return slide.slideRole ? slideRoleLabels[slide.slideRole][language] : language === 'Korean' ? '역할 미기록' : 'Role not recorded';
}

const redundancyKindLabels: Record<PptRedundancySuggestion['kind'], string> = {
  title: 'Similar title',
  message: 'Similar message',
  case: 'Similar evidence',
  diagram: 'Similar diagram',
};

const redundancyActionLabels: Record<PptRedundancySuggestion['action'], string> = {
  merge: 'Merge',
  remove: 'Remove duplicate',
  'separate-role': 'Separate roles',
};

const coverageKindLabels: Record<PptCoverageSuggestion['kind'], string> = {
  solution: 'Solution',
  feature: 'Capabilities',
  kpi: 'KPI / measure',
  impact: 'Expected impact',
};

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
              {deckPlan?.blueprint?.sections.length ? (
                <section className="border-y border-border py-4" aria-labelledby="deck-outline-heading">
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
                    <div>
                      <h3 id="deck-outline-heading" className="text-sm font-bold text-primary">Auto-generated deck outline</h3>
                      <p className="mt-1 text-sm text-text-subtle">The outline allocates the full deck before section drafts are generated.</p>
                    </div>
                    <p className="text-xs font-semibold text-text-subtle">{slides.length} slides across {deckPlan.blueprint.sections.length} sections</p>
                  </div>
                  <ol className="mt-4 grid gap-3 lg:grid-cols-2">
                    {deckPlan.blueprint.sections.map((section, index) => (
                      <li key={section.id} className="border border-border bg-surface p-3">
                        <div className="flex items-center justify-between gap-3 text-xs font-semibold text-text-subtle">
                          <span>Section {index + 1}</span>
                          <span>Slides {section.slideStart}-{section.slideStart + section.slideCount - 1}</span>
                        </div>
                        <h4 className="mt-2 text-sm font-bold text-text-main">{section.title}</h4>
                        <dl className="mt-3 space-y-2 text-sm">
                          <div>
                            <dt className="text-xs font-bold uppercase text-accent">Role</dt>
                            <dd className="mt-0.5 text-text-main">{section.role ?? section.purpose}</dd>
                          </div>
                          <div>
                            <dt className="text-xs font-bold uppercase text-accent">Key question</dt>
                            <dd className="mt-0.5 font-medium text-text-main">{section.keyQuestion ?? section.keyMessage}</dd>
                          </div>
                          <div>
                            <dt className="text-xs font-bold uppercase text-accent">Section message</dt>
                            <dd className="mt-0.5 text-text-subtle">{section.keyMessage}</dd>
                          </div>
                        </dl>
                      </li>
                    ))}
                  </ol>
                </section>
              ) : null}
              <div className="rounded-md border border-border bg-surface-muted px-4 py-3 text-sm text-text-subtle">
                Role: <span className="font-semibold text-text-main">{getSlideRoleLabel(selectedSlide, deckPlan?.request.targetLanguage ?? 'English')}</span>. Master: <span className="font-semibold text-text-main">{selectedSlide.masterLayout ?? 'content'}</span>. Layout: <span className="font-semibold text-text-main">{selectedSlide.visualStructure}</span>. {selectedSlide.layoutSelection ? <>Content type: <span className="font-semibold text-text-main">{selectedSlide.layoutSelection.classification}</span>. Layout family: <span className="font-semibold text-text-main">{selectedSlide.layoutSelection.family}</span>. {selectedSlide.layoutSelection.rationale} </> : null}This deck does not generate a slide image layer; text, cards, connectors, and diagrams are native export targets.
              </div>
              {selectedSlide.dependency ? (
                <section className="border-y border-border py-3" aria-labelledby="narrative-connection-heading">
                  <h3 id="narrative-connection-heading" className="text-sm font-bold text-primary">Narrative connection</h3>
                  <div className="mt-2 grid gap-3 text-sm lg:grid-cols-3">
                    <div>
                      <p className="text-xs font-bold uppercase text-accent">Question addressed</p>
                      <p className="mt-1 text-text-main">{selectedSlide.dependency.questionAddressed}</p>
                    </div>
                    <div>
                      <p className="text-xs font-bold uppercase text-accent">This slide resolves</p>
                      <p className="mt-1 text-text-main">{selectedSlide.dependency.answerSummary}</p>
                    </div>
                    <div>
                      <p className="text-xs font-bold uppercase text-accent">Next question</p>
                      <p className="mt-1 text-text-main">{selectedSlide.dependency.nextQuestion ?? 'Narrative closes on this slide.'}</p>
                    </div>
                  </div>
                </section>
              ) : null}
              {deckPlan?.copyQa.redundancySuggestions?.length ? (
                <section className="border-y border-border py-3" aria-labelledby="redundancy-review-heading">
                  <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <h3 id="redundancy-review-heading" className="text-sm font-bold text-primary">Redundancy review</h3>
                      <p className="mt-1 text-sm text-text-subtle">Similar content is flagged for editorial review without blocking the deck.</p>
                    </div>
                    <span className="text-xs font-semibold text-text-subtle">{deckPlan.copyQa.redundancySuggestions.length} suggestion(s)</span>
                  </div>
                  <ul className="mt-3 space-y-2">
                    {deckPlan.copyQa.redundancySuggestions.slice(0, 6).map((suggestion) => (
                      <li key={suggestion.id} className="border border-border bg-surface-muted px-3 py-2.5 text-sm">
                        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                          <span className="font-semibold text-text-main">Slides {suggestion.slideNumbers[0]} and {suggestion.slideNumbers[1]}</span>
                          <span className="text-text-subtle">· {redundancyKindLabels[suggestion.kind]}</span>
                          <span className="rounded-sm bg-primary px-1.5 py-0.5 text-xs font-semibold text-white">{redundancyActionLabels[suggestion.action]}</span>
                          <span className="text-xs font-semibold text-text-subtle">{suggestion.confidence}% match</span>
                        </div>
                        <p className="mt-1 text-text-subtle">{suggestion.summary}</p>
                      </li>
                    ))}
                  </ul>
                </section>
              ) : null}
              {deckPlan?.copyQa.coverageSuggestions?.length ? (
                <section className="border-y border-border py-3" aria-labelledby="coverage-review-heading">
                  <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <h3 id="coverage-review-heading" className="text-sm font-bold text-primary">Missing content review</h3>
                      <p className="mt-1 text-sm text-text-subtle">Problem statements are checked against the proposed solution, capabilities, measurement, and expected impact.</p>
                    </div>
                    <span className="text-xs font-semibold text-text-subtle">{deckPlan.copyQa.coverageSuggestions.length} gap(s)</span>
                  </div>
                  <ul className="mt-3 space-y-2">
                    {deckPlan.copyQa.coverageSuggestions.map((suggestion) => (
                      <li key={suggestion.id} className="border border-border bg-surface-muted px-3 py-2.5 text-sm">
                        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                          <span className="font-semibold text-text-main">{coverageKindLabels[suggestion.kind]} after slide{suggestion.problemSlideNumbers.length > 1 ? 's' : ''} {suggestion.problemSlideNumbers.join(', ')}</span>
                          <span className={suggestion.severity === 'required' ? 'rounded-sm bg-accent px-1.5 py-0.5 text-xs font-semibold text-white' : 'rounded-sm bg-primary px-1.5 py-0.5 text-xs font-semibold text-white'}>{suggestion.severity === 'required' ? 'Required' : 'Recommended'}</span>
                          <span className="text-xs font-semibold text-text-subtle">Add: {suggestion.recommendedSlideRole} / {suggestion.recommendedVisualStructure}</span>
                        </div>
                        <p className="mt-1 text-text-subtle">{suggestion.summary}</p>
                      </li>
                    ))}
                  </ul>
                </section>
              ) : null}
              <figure className="overflow-hidden rounded-md border border-border bg-surface">
                <button type="button" className="group relative block w-full overflow-hidden bg-surface-muted text-left" onClick={() => setExpandedSlide(selectedSlide)} aria-label={`Open slide ${selectedSlide.pageNumber} preview`}>
                  <div className="mx-auto w-[min(100%,960px)] overflow-hidden">
                    <PptHtmlSlide slide={selectedSlide} logoImageDataUrl={deckPlan?.request.logoImageDataUrl} styleReference={deckPlan?.request.styleReference} sourceReferences={deckPlan?.request.sourceMaterialAnalysis?.sources} totalSlides={deckPlan?.slides.length} previewScale={0.5} />
                  </div>
                  <span className="absolute right-3 top-3 inline-flex items-center gap-1 rounded-md bg-primary px-2.5 py-1 text-xs font-semibold text-white opacity-90 transition group-hover:opacity-100"><Maximize2 className="h-3.5 w-3.5" />Expand</span>
                </button>
                <figcaption className="flex items-center justify-between gap-2 px-4 py-3 text-sm text-text-subtle"><span className="font-semibold text-text-main">Slide {selectedSlide.pageNumber}</span><span>{selectedSlide.visualStructure}</span></figcaption>
              </figure>
              <div className="flex gap-3 overflow-x-auto pb-2">
                {slides.map((slide) => (
                  <button key={slide.id} type="button" className={['w-[240px] shrink-0 overflow-hidden rounded-md border bg-surface text-left transition', slide.id === selectedSlide.id ? 'border-primary shadow-sm' : 'border-border hover:border-primary'].join(' ')} onClick={() => setSelectedSlideId(slide.id)}>
                    <div className="h-[135px] overflow-hidden"><PptHtmlSlide slide={slide} logoImageDataUrl={deckPlan?.request.logoImageDataUrl} styleReference={deckPlan?.request.styleReference} sourceReferences={deckPlan?.request.sourceMaterialAnalysis?.sources} totalSlides={deckPlan?.slides.length} previewScale={0.125} /></div>
                    <span className="block px-3 py-2 text-xs font-semibold text-text-subtle">Slide {slide.pageNumber} | {getSlideRoleLabel(slide, deckPlan?.request.targetLanguage ?? 'English')}</span>
                  </button>
                ))}
              </div>
              {deckPlan?.request.sourceMaterialAnalysis?.sources?.length ? <section className="rounded-md border border-border bg-surface p-4"><h3 className="text-sm font-bold text-primary">Source registry</h3><p className="mt-1 text-sm text-text-subtle">Fact and metric slides link to these source records. Complete missing metadata before external distribution.</p><div className="mt-3 space-y-2">{deckPlan.request.sourceMaterialAnalysis.sources.map((source) => <div key={source.id} className="flex flex-col gap-1 border-t border-border pt-2 text-sm text-text-subtle sm:flex-row sm:items-center sm:justify-between"><span><span className="font-semibold text-text-main">{source.sourceName}</span> · {source.documentName} · {source.publicationYear ?? 'Year not recorded'} · checked {source.verifiedAt}</span>{source.url ? <a className="inline-flex items-center gap-1 font-semibold text-primary hover:underline" href={source.url} target="_blank" rel="noreferrer">Open source <ExternalLink className="h-3.5 w-3.5" /></a> : <span className="text-xs text-accent">URL not recorded</span>}</div>)}</div></section> : null}
              {documentEnhancement ? <div className="rounded-md border border-border bg-surface-muted px-4 py-3"><div className="flex items-center gap-2 text-sm font-bold text-primary"><FileText className="h-4 w-4" />{documentEnhancement.title}</div><ul className="mt-2 space-y-1 text-sm text-text-subtle">{documentEnhancement.qaChecklist.slice(0, 3).map((check) => <li key={check}>• {check}</li>)}</ul></div> : null}
            </div>
          )}
        </CardContent>
      </Card>
      {expandedSlide && deckPlan ? <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 p-4" role="dialog" aria-modal="true" aria-label={`Slide ${expandedSlide.pageNumber} preview`}><div className="max-h-full max-w-full overflow-auto rounded-md bg-surface p-3 shadow-xl"><div className="mb-3 flex justify-end"><Button variant="secondary" onClick={() => setExpandedSlide(null)}><X className="h-4 w-4" />Close</Button></div><div className="w-[min(100%,1344px)] overflow-hidden"><PptHtmlSlide slide={expandedSlide} logoImageDataUrl={deckPlan.request.logoImageDataUrl} styleReference={deckPlan.request.styleReference} sourceReferences={deckPlan.request.sourceMaterialAnalysis?.sources} totalSlides={deckPlan.slides.length} previewScale={0.7} /></div></div></div> : null}
    </>
  );
}
