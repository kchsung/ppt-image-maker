import { useEffect, useMemo, useState } from 'react';
import { Check, ChevronLeft, ChevronRight, FileText, FileUp, ImageUp, LoaderCircle, ScanSearch, Sparkles, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/cn';
import { getPresentationDesignGuide } from '@/mocks/presentationGuides.mock';
import { getPresentationPurposeTemplate, presentationPurposeTemplates } from '@/mocks/presentationPurposeTemplates.mock';
import type {
  ContentDensity,
  PresentationPurposeTemplateId,
  PptClarifyingQuestion,
  PptMakerFormState,
  PptTemplate,
  StyleSourceMode,
  TargetLanguage,
} from '@/types/models/pptMaker.model';
import { extractSourceDocument } from '@/utils/sourceDocument';

interface PptMakerFormProps {
  form: PptMakerFormState;
  templates: PptTemplate[];
  isLoading: boolean;
  isAnalyzingRequest: boolean;
  onChange: (patch: Partial<PptMakerFormState>) => void;
  onAnalyzeRequest: () => void;
  onTemplateSelect: (template: PptTemplate) => void;
  onSubmit: () => void;
}

export function PptMakerForm({
  form,
  templates,
  isLoading,
  isAnalyzingRequest,
  onChange,
  onAnalyzeRequest,
  onTemplateSelect,
  onSubmit,
}: PptMakerFormProps) {
  const selectedTemplateIndex = useMemo(() => {
    const index = templates.findIndex((template) => template.id === form.selectedTemplateId);
    return index >= 0 ? index : 0;
  }, [form.selectedTemplateId, templates]);
  const [activeTemplateIndex, setActiveTemplateIndex] = useState(selectedTemplateIndex);
  const [sourceFileError, setSourceFileError] = useState<string | null>(null);
  const [isExtractingSource, setIsExtractingSource] = useState(false);
  const activeTemplate = templates[activeTemplateIndex] ?? templates[0];
  const purposeTemplate = getPresentationPurposeTemplate(form.purposeTemplateId);
  const presentationGuide = getPresentationDesignGuide(purposeTemplate.presentationIntent);
  const isActiveTemplateSelected = activeTemplate ? form.selectedTemplateId === activeTemplate.id : false;
  const hasStyleReference =
    form.styleSourceMode === 'template' ? Boolean(form.selectedTemplateId) : Boolean(form.styleImageDataUrl);
  const hasSource = form.sourceText.trim().length >= 40 || form.sourceAttachments.length > 0;
  const unansweredClarifications = form.requestAnalysis?.clarifyingQuestions.filter(
    (question) => question.required && !form.clarificationAnswers[question.id],
  ) ?? [];
  const attachmentAnalysisRequired = form.sourceAttachments.length > 0 && !form.sourceMaterialAnalysis;
  const canSubmit = hasSource && hasStyleReference && !isLoading && !isAnalyzingRequest && !attachmentAnalysisRequired && unansweredClarifications.length === 0;

  useEffect(() => {
    setActiveTemplateIndex(selectedTemplateIndex);
  }, [selectedTemplateIndex]);

  const handleImageChange = (file: File | undefined) => {
    if (!file) {
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        onChange({ styleImageDataUrl: reader.result });
      }
    };
    reader.readAsDataURL(file);
  };

  const handleSourceDocumentChange = async (files: FileList | null) => {
    const selectedFiles = files ? Array.from(files).slice(0, 8) : [];
    if (selectedFiles.length === 0) {
      return;
    }

    setIsExtractingSource(true);
    setSourceFileError(null);
    try {
      const extractedDocuments = await Promise.all(selectedFiles.map((file) => extractSourceDocument(file)));
      const newAttachments = extractedDocuments.map((document) => document.attachment);
      const attachmentIds = new Set(form.sourceAttachments.map((attachment) => attachment.id));
      const sourceAttachments = [
        ...form.sourceAttachments,
        ...newAttachments.filter((attachment) => !attachmentIds.has(attachment.id)),
      ];
      const extractedText = extractedDocuments
        .filter((document) => document.attachment.type !== 'image' && document.text)
        .map((document) => `[Source: ${document.document.name}]\n${document.text}`)
        .join('\n\n');
      const sourceText = [form.sourceText.trim(), extractedText].filter(Boolean).join('\n\n');
      const lastTextDocument = [...extractedDocuments].reverse().find((document) => document.attachment.type !== 'image');
      onChange({
        sourceText,
        sourceAttachments,
        sourceDocument: lastTextDocument?.document ?? form.sourceDocument,
        sourceMaterialAnalysis: null,
        requestAnalysis: null,
        clarificationAnswers: {},
      });
    } catch (error) {
      setSourceFileError(error instanceof Error ? error.message : 'Could not read the selected document.');
    } finally {
      setIsExtractingSource(false);
    }
  };

  const handleLogoChange = (file: File | undefined) => {
    if (!file) {
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        onChange({ logoImageDataUrl: reader.result });
      }
    };
    reader.readAsDataURL(file);
  };

  const setSourceMode = (styleSourceMode: StyleSourceMode) => {
    onChange({ styleSourceMode });
  };

  const handlePurposeTemplateChange = (purposeTemplateId: PresentationPurposeTemplateId) => {
    const selectedPurposeTemplate = getPresentationPurposeTemplate(purposeTemplateId);
    onChange({
      purposeTemplateId,
      presentationIntent: selectedPurposeTemplate.presentationIntent,
      documentType: selectedPurposeTemplate.documentType,
      audience: selectedPurposeTemplate.defaultAudience,
      purpose: selectedPurposeTemplate.defaultPurpose,
      requiredSections: selectedPurposeTemplate.defaultOutline.join(', '),
      requestAnalysis: null,
      clarificationAnswers: {},
    });
  };

  const showPreviousTemplate = () => {
    setActiveTemplateIndex((currentIndex) => (currentIndex === 0 ? templates.length - 1 : currentIndex - 1));
  };

  const showNextTemplate = () => {
    setActiveTemplateIndex((currentIndex) => (currentIndex + 1) % templates.length);
  };

  const handleClarificationAnswer = (question: PptClarifyingQuestion, value: string) => {
    const patch: Partial<PptMakerFormState> = {
      clarificationAnswers: { ...form.clarificationAnswers, [question.id]: value },
    };

    if (question.field === 'purpose') patch.purpose = value;
    if (question.field === 'audience') patch.audience = value;
    if (question.field === 'presentationDurationMinutes') {
      const minutes = Number(value);
      const minutesPerSlide = form.contentDensity === 'detailed' ? 2.5 : form.contentDensity === 'light' ? 1.25 : 1.75;
      patch.presentationDurationMinutes = minutes;
      patch.slideCount = Math.min(100, Math.max(2, Math.round(minutes / minutesPerSlide)));
    }
    if (question.field === 'contentDensity') patch.contentDensity = value as ContentDensity;
    if (question.field === 'styleNotes') {
      patch.styleNotes = form.styleNotes.includes(value) ? form.styleNotes : `${form.styleNotes}\n${value}`.trim();
    }

    onChange(patch);
  };

  return (
    <Card>
      <CardHeader>
        <h2 className="text-base font-bold text-primary">Source and style</h2>
        <p className="mt-1 text-sm text-text-subtle">
          Paste notes or attach source files. Text, tables, and visual references are carried into production planning.
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="block text-sm font-semibold text-text-main">Source</span>
            <label className="inline-flex cursor-pointer items-center gap-2 rounded-md border border-border bg-surface px-3 py-2 text-sm font-semibold text-text-subtle transition hover:border-primary hover:text-primary">
              {isExtractingSource ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <FileUp className="h-4 w-4" />}
              {isExtractingSource ? 'Reading sources...' : 'Add source files'}
              <input
                aria-label="Source files"
                className="sr-only"
                type="file"
                multiple
                accept=".docx,.pdf,.pptx,.xlsx,.png,.jpg,.jpeg,.webp,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.openxmlformats-officedocument.presentationml.presentation,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,image/png,image/jpeg,image/webp"
                disabled={isExtractingSource}
                onChange={(event) => {
                  void handleSourceDocumentChange(event.target.files);
                  event.currentTarget.value = '';
                }}
              />
            </label>
          </div>
          <Textarea
            aria-label="Source text"
            value={form.sourceText}
            placeholder="Paste source material or add PDF, DOCX, PPTX, XLSX, or image files..."
            onChange={(event) => onChange({ sourceText: event.target.value, sourceMaterialAnalysis: null, requestAnalysis: null, clarificationAnswers: {} })}
          />
          {form.sourceAttachments.length > 0 ? (
            <div className="space-y-2">
              {form.sourceAttachments.map((attachment) => (
                <div key={attachment.id} className="flex items-center gap-2 rounded-md border border-border bg-surface-muted px-3 py-2 text-sm text-text-subtle">
                  {attachment.imageDataUrl ? (
                    <img src={attachment.imageDataUrl} alt="" className="h-9 w-12 rounded border border-border object-cover" />
                  ) : attachment.type === 'image' ? <ImageUp className="h-4 w-4 text-primary" /> : <FileText className="h-4 w-4 text-primary" />}
                  <span className="min-w-0 flex-1 truncate">{attachment.name}</span>
                  <span className="shrink-0 text-xs">
                    {attachment.type.toUpperCase()} · {attachment.extractedCharacterCount.toLocaleString()} text · {attachment.tableCount} tables
                  </span>
                  <Button
                    type="button"
                    variant="ghost"
                    className="h-7 w-7 px-0"
                    onClick={() => onChange({
                      sourceAttachments: form.sourceAttachments.filter((item) => item.id !== attachment.id),
                      sourceDocument: form.sourceDocument?.name === attachment.name ? null : form.sourceDocument,
                      sourceMaterialAnalysis: null,
                      requestAnalysis: null,
                      clarificationAnswers: {},
                    })}
                    aria-label={`Remove ${attachment.name}`}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          ) : null}
          {sourceFileError ? <p className="text-sm font-medium text-accent">{sourceFileError}</p> : null}
          {attachmentAnalysisRequired ? <p className="text-sm font-medium text-accent">Analyze the uploaded materials before creating the deck.</p> : null}
        </div>

        <div className="rounded-md border border-primary/20 bg-surface-muted p-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-sm font-bold text-primary">PPT production conditions</p>
              <p className="mt-1 text-sm text-text-subtle">
                Extract the topic, purpose, audience, presentation duration, recommended slide count, and document type from the source and instructions.
              </p>
            </div>
            <Button type="button" variant="secondary" disabled={!hasSource || isLoading || isAnalyzingRequest} onClick={onAnalyzeRequest}>
              {isAnalyzingRequest ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <ScanSearch className="h-4 w-4" />}
              {isAnalyzingRequest ? 'Analyzing request...' : 'Analyze request'}
            </Button>
          </div>
          {form.requestAnalysis ? (
            <div className="mt-4 grid gap-2 text-sm sm:grid-cols-2 lg:grid-cols-3">
              {[
                ['Topic', form.requestAnalysis.topic],
                ['Document type', form.requestAnalysis.documentType],
                ['Duration', form.requestAnalysis.presentationDurationMinutes ? `${form.requestAnalysis.presentationDurationMinutes} min` : 'Not detected'],
                ['Slide count', `${form.requestAnalysis.slideCount} slides`],
                ['Audience', form.requestAnalysis.audience],
                ['Purpose', form.requestAnalysis.purpose],
              ].map(([label, value]) => (
                <div key={label} className="rounded-md border border-border bg-surface px-3 py-2">
                  <p className="text-xs font-semibold uppercase tracking-wide text-text-subtle">{label}</p>
                  <p className="mt-1 font-semibold text-text-main">{value}</p>
                </div>
              ))}
            </div>
          ) : null}
          {form.sourceMaterialAnalysis ? (
            <div className="mt-4 rounded-md border border-border bg-surface p-4">
              <p className="text-sm font-bold text-primary">Extracted material</p>
              <p className="mt-2 text-sm leading-6 text-text-subtle">{form.sourceMaterialAnalysis.summary}</p>
              <div className="mt-3 grid gap-3 lg:grid-cols-3">
                <SourceAnalysisList title="Key points" values={form.sourceMaterialAnalysis.keyPoints} />
                <SourceAnalysisList title="Usable data" values={form.sourceMaterialAnalysis.dataPoints} />
                <SourceAnalysisList title="Visual references" values={form.sourceMaterialAnalysis.availableVisuals} />
              </div>
              {form.sourceMaterialAnalysis.sources?.length ? <div className="mt-3 border-t border-border pt-3"><p className="text-sm font-semibold text-text-main">Source records</p><div className="mt-2 space-y-1 text-sm text-text-subtle">{form.sourceMaterialAnalysis.sources.map((source) => <p key={source.id}><span className="font-semibold text-text-main">{source.sourceName}</span> · {source.documentName} · {source.publicationYear ?? 'Year not recorded'} · checked {source.verifiedAt}{source.url ? ` · ${source.url}` : ''}</p>)}</div></div> : null}
            </div>
          ) : null}
          {form.requestAnalysis?.clarifyingQuestions.length ? (
            <div className="mt-4 border-t border-border pt-4">
              <p className="text-sm font-bold text-text-main">Complete the missing conditions</p>
              <p className="mt-1 text-sm text-text-subtle">
                Choose an answer for every required item before the deck can be planned.
              </p>
              <div className="mt-3 space-y-3">
                {form.requestAnalysis.clarifyingQuestions.map((question) => {
                  const selectedAnswer = form.clarificationAnswers[question.id];
                  return (
                    <div key={question.id} className="rounded-md border border-border bg-surface p-3">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-semibold text-text-main">{question.question}</p>
                        {question.required ? <span className="rounded-full bg-accent-muted px-2 py-0.5 text-xs font-bold text-accent">Required</span> : null}
                      </div>
                      <div className="mt-3 flex flex-wrap gap-2">
                        {question.options.map((option) => (
                          <Button
                            key={option.value}
                            type="button"
                            variant={selectedAnswer === option.value ? 'primary' : 'secondary'}
                            className="h-8 px-3 text-xs"
                            onClick={() => handleClarificationAnswer(question, option.value)}
                          >
                            {option.label}
                          </Button>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
              {unansweredClarifications.length ? (
                <p className="mt-3 text-sm font-semibold text-accent">
                  {unansweredClarifications.length} required condition{unansweredClarifications.length === 1 ? '' : 's'} still need confirmation.
                </p>
              ) : (
                <p className="mt-3 text-sm font-semibold text-success">All required production conditions are confirmed.</p>
              )}
            </div>
          ) : null}
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block sm:col-span-2">
            <span className="mb-1 block text-sm font-semibold text-text-main">Topic</span>
            <Input value={form.topic} placeholder="The central subject of this presentation" onChange={(event) => onChange({ topic: event.target.value })} />
          </label>
          <label className="block">
            <span className="mb-1 block text-sm font-semibold text-text-main">Audience</span>
            <Input
              value={form.audience}
              onChange={(event) => onChange({ audience: event.target.value })}
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-sm font-semibold text-text-main">Purpose</span>
            <Input
              value={form.purpose}
              onChange={(event) => onChange({ purpose: event.target.value })}
            />
          </label>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block">
            <span className="mb-1 block text-sm font-semibold text-text-main">PPT purpose template</span>
            <select
              aria-label="PPT purpose template"
              className="h-10 w-full rounded-md border border-border bg-surface px-3 text-sm outline-none focus:border-primary"
              value={purposeTemplate.id}
              onChange={(event) => handlePurposeTemplateChange(event.target.value as PresentationPurposeTemplateId)}
            >
              {Object.values(presentationPurposeTemplates).map((template) => (
                <option key={template.id} value={template.id}>{template.name}</option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="mb-1 block text-sm font-semibold text-text-main">Document type</span>
            <select
              disabled
              className="h-10 w-full rounded-md border border-border bg-surface px-3 text-sm outline-none focus:border-primary"
              value={purposeTemplate.documentType}
            >
              <option value="proposal">Proposal</option>
              <option value="strategy">Strategy deck</option>
              <option value="lecture">Lecture or training</option>
              <option value="investment">Investment or IR deck</option>
              <option value="roadmap">Implementation roadmap</option>
              <option value="report">Report</option>
            </select>
          </label>
          <label className="block">
            <span className="mb-1 block text-sm font-semibold text-text-main">Language</span>
            <select
              className="h-10 w-full rounded-md border border-border bg-surface px-3 text-sm outline-none focus:border-primary"
              value={form.targetLanguage}
              onChange={(event) => onChange({ targetLanguage: event.target.value as TargetLanguage })}
            >
              <option value="English">English</option>
              <option value="Korean">Korean</option>
            </select>
          </label>
          <label className="block">
            <span className="mb-1 block text-sm font-semibold text-text-main">Presentation duration (minutes)</span>
            <Input
              min={1}
              max={480}
              type="number"
              value={form.presentationDurationMinutes ?? ''}
              placeholder="For example: 30"
              onChange={(event) => onChange({ presentationDurationMinutes: event.target.value ? Number(event.target.value) : null })}
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-sm font-semibold text-text-main">Slide count</span>
            <Input
              min={2}
              max={100}
              type="number"
              value={form.slideCount}
              onChange={(event) => onChange({ slideCount: Number(event.target.value) })}
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-sm font-semibold text-text-main">Content detail</span>
            <select
              className="h-10 w-full rounded-md border border-border bg-surface px-3 text-sm outline-none focus:border-primary"
              value={form.contentDensity}
              onChange={(event) => onChange({ contentDensity: event.target.value as ContentDensity })}
            >
              <option value="light">조금</option>
              <option value="standard">중간</option>
              <option value="detailed">많음</option>
            </select>
          </label>
        </div>

        <label className="block">
          <span className="mb-1 block text-sm font-semibold text-text-main">Core message</span>
          <Input
            value={form.coreMessage ?? ''}
            placeholder="The single conclusion the audience should remember and act on."
            onChange={(event) => onChange({ coreMessage: event.target.value })}
          />
        </label>

        <label className="block">
          <span className="mb-1 block text-sm font-semibold text-text-main">Required sections</span>
          <Textarea
            aria-label="Required sections"
            className="min-h-20"
            value={form.requiredSections ?? ''}
            placeholder="For example: current challenge, operating model, proof points, rollout roadmap, expected outcomes."
            onChange={(event) => onChange({ requiredSections: event.target.value })}
          />
        </label>

        <div className="rounded-md border border-primary/20 bg-surface-muted p-4">
          <p className="text-xs font-bold uppercase tracking-wide text-accent">Purpose template and planning contract</p>
          <h3 className="mt-1 text-base font-bold text-primary">{purposeTemplate.name}</h3>
          <p className="mt-2 text-sm leading-6 text-text-main">{purposeTemplate.description}</p>
          <div className="mt-3 grid gap-3 lg:grid-cols-2">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-text-subtle">Default outline</p>
              <ol className="mt-2 grid gap-2 text-sm text-text-subtle sm:grid-cols-2">
                {purposeTemplate.defaultOutline.map((section, index) => (
                  <li key={section} className="rounded-md border border-border bg-surface px-3 py-2">
                    <span className="mr-2 font-bold text-primary">{index + 1}.</span>{section}
                  </li>
                ))}
              </ol>
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-text-subtle">Composition rules</p>
              <ul className="mt-2 grid gap-2 text-sm text-text-subtle">
                {purposeTemplate.compositionRules.map((rule) => (
                  <li key={rule} className="rounded-md border border-border bg-surface px-3 py-2">{rule}</li>
                ))}
              </ul>
            </div>
          </div>
          <p className="mt-3 text-sm leading-6 text-text-subtle">{presentationGuide.narrativeGuide}</p>
          <ul className="mt-3 grid gap-2 text-sm text-text-subtle sm:grid-cols-3">
            {presentationGuide.slideRules.map((rule) => (
              <li key={rule} className="rounded-md border border-border bg-surface px-3 py-2">{rule}</li>
            ))}
          </ul>
        </div>

        <label className="block">
          <span className="mb-1 block text-sm font-semibold text-text-main">Additional instructions</span>
          <Textarea
            aria-label="Creation instructions"
            className="min-h-24"
            value={form.creationInstructions}
            placeholder="Add constraints for evidence, tone, exclusions, mandatory data points, or a preferred storytelling flow."
            onChange={(event) => onChange({ creationInstructions: event.target.value })}
          />
        </label>

        <label className="block">
          <span className="mb-1 block text-sm font-semibold text-text-main">Style reference notes</span>
          <Textarea
            aria-label="Style reference notes"
            className="min-h-24"
            value={form.styleNotes}
            onChange={(event) => onChange({ styleNotes: event.target.value })}
          />
        </label>

        <div className="rounded-md border border-border bg-surface-muted p-3">
          <div className="mb-3">
            <p className="text-sm font-semibold text-text-main">Logo</p>
            <p className="mt-1 text-xs text-text-subtle">
              Leave empty to keep a logo placeholder. Upload a logo only when it should be placed in the PPT.
            </p>
          </div>
          {form.logoImageDataUrl ? (
            <div className="flex items-center gap-3">
              <div className="flex h-16 w-28 items-center justify-center rounded-md border border-border bg-surface p-2">
                <img src={form.logoImageDataUrl} alt="Uploaded logo" className="max-h-full max-w-full object-contain" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-text-main">Logo loaded</p>
                <p className="text-xs text-text-subtle">The logo will be inserted in the PPT logo area.</p>
              </div>
              <Button variant="ghost" onClick={() => onChange({ logoImageDataUrl: null })} aria-label="Remove logo">
                <X className="h-4 w-4" />
              </Button>
            </div>
          ) : (
            <label className="flex cursor-pointer items-center justify-center gap-2 rounded-md bg-surface px-4 py-4 text-sm font-semibold text-text-subtle transition hover:text-primary">
              <ImageUp className="h-4 w-4" />
              Upload logo image
              <input
                aria-label="Logo image"
                className="sr-only"
                type="file"
                accept="image/png,image/jpeg,image/webp,image/svg+xml"
                onChange={(event) => handleLogoChange(event.target.files?.[0])}
              />
            </label>
          )}
        </div>

        <div className="space-y-3">
          <div className="flex items-center justify-between gap-3">
            <span className="block text-sm font-semibold text-text-main">Style source</span>
            <div className="inline-flex rounded-md border border-border bg-surface p-1">
              <Button
                className="h-8 px-3"
                variant={form.styleSourceMode === 'template' ? 'primary' : 'ghost'}
                onClick={() => setSourceMode('template')}
              >
                Template
              </Button>
              <Button
                className="h-8 px-3"
                variant={form.styleSourceMode === 'upload' ? 'primary' : 'ghost'}
                onClick={() => setSourceMode('upload')}
              >
                Upload
              </Button>
            </div>
          </div>

          {form.styleSourceMode === 'template' && activeTemplate ? (
            <div className="rounded-md border border-border bg-surface-muted p-3">
              <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_260px]">
                <div className="relative overflow-hidden rounded-md border border-border bg-surface">
                  <img
                    src={activeTemplate.imageUrl}
                    alt={activeTemplate.label}
                    className="aspect-video w-full object-cover"
                  />
                  <span className="absolute left-3 top-3 rounded-full bg-primary px-3 py-1 text-xs font-bold text-white">
                    {activeTemplate.label}
                  </span>
                  {isActiveTemplateSelected ? (
                    <span className="absolute right-3 top-3 inline-flex items-center gap-1 rounded-full bg-accent px-2 py-1 text-xs font-bold text-white">
                      <Check className="h-3.5 w-3.5" />
                      Selected
                    </span>
                  ) : null}
                  <Button
                    type="button"
                    variant="secondary"
                    className="absolute left-3 top-1/2 h-10 w-10 -translate-y-1/2 px-0"
                    onClick={showPreviousTemplate}
                    aria-label="Previous template"
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <Button
                    type="button"
                    variant="secondary"
                    className="absolute right-3 top-1/2 h-10 w-10 -translate-y-1/2 px-0"
                    onClick={showNextTemplate}
                    aria-label="Next template"
                  >
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>

                <div className="flex flex-col justify-between gap-4 rounded-md border border-border bg-surface p-4">
                  <div>
                    <p className="text-xs font-bold uppercase tracking-wide text-accent">
                      {activeTemplateIndex + 1} / {templates.length}
                    </p>
                    <h3 className="mt-2 text-base font-bold text-text-main">{activeTemplate.name}</h3>
                    <p className="mt-2 text-sm leading-6 text-text-subtle">{activeTemplate.description}</p>
                    <p className="mt-3 text-xs font-semibold text-text-subtle">
                      Accent: {activeTemplate.accentColorLabel}
                    </p>
                  </div>
                  <Button
                    type="button"
                    variant={isActiveTemplateSelected ? 'secondary' : 'primary'}
                    onClick={() => onTemplateSelect(activeTemplate)}
                  >
                    {isActiveTemplateSelected ? (
                      <>
                        <Check className="h-4 w-4" />
                        Selected
                      </>
                    ) : (
                      'Use this template'
                    )}
                  </Button>
                </div>
              </div>

              <div className="mt-3 flex flex-wrap items-center justify-center gap-2">
                {templates.map((template, index) => {
                  const isActive = index === activeTemplateIndex;
                  const isSelected = template.id === form.selectedTemplateId;
                  return (
                    <button
                      key={template.id}
                      type="button"
                      className={cn(
                        'h-2.5 rounded-full transition',
                        isActive || isSelected ? 'w-7 bg-primary' : 'w-2.5 bg-border hover:bg-text-subtle',
                      )}
                      onClick={() => setActiveTemplateIndex(index)}
                      aria-label={`Show ${template.label}`}
                    />
                  );
                })}
              </div>
            </div>
          ) : (
            <div className="rounded-md border border-dashed border-border bg-surface-muted p-3">
              {form.styleImageDataUrl ? (
                <div className="flex items-center gap-3">
                  <img
                    src={form.styleImageDataUrl}
                    alt="Sample slide reference"
                    className="h-20 w-32 rounded-md border border-border object-cover"
                  />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-text-main">Reference image loaded</p>
                    <p className="text-xs text-text-subtle">Used as a visual reference for the Slide JSON layout system.</p>
                  </div>
                  <Button
                    variant="ghost"
                    onClick={() => onChange({ styleImageDataUrl: null })}
                    aria-label="Remove sample image"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              ) : (
                <label className="flex cursor-pointer items-center justify-center gap-2 rounded-md bg-surface px-4 py-5 text-sm font-semibold text-text-subtle transition hover:text-primary">
                  <ImageUp className="h-4 w-4" />
                  Upload sample slide image
                  <input
                    aria-label="Sample slide image"
                    className="sr-only"
                    type="file"
                    accept="image/png,image/jpeg,image/webp"
                    onChange={(event) => handleImageChange(event.target.files?.[0])}
                  />
                </label>
              )}
            </div>
          )}
        </div>

        <Button className="w-full sm:w-auto" disabled={!canSubmit} onClick={onSubmit}>
          <Sparkles className="h-4 w-4" />
          {isLoading ? 'Planning deck...' : 'Create PPT deck'}
        </Button>
      </CardContent>
    </Card>
  );
}

function SourceAnalysisList({ title, values }: { title: string; values: string[] }) {
  return (
    <div className="rounded-md bg-surface-muted p-3">
      <p className="text-xs font-bold uppercase tracking-wide text-text-subtle">{title}</p>
      {values.length > 0 ? (
        <ul className="mt-2 space-y-1 text-sm text-text-main">
          {values.slice(0, 4).map((value) => <li key={value}>• {value}</li>)}
        </ul>
      ) : <p className="mt-2 text-sm text-text-subtle">No material detected</p>}
    </div>
  );
}
