import { useEffect, useMemo, useState } from 'react';
import { Check, ChevronLeft, ChevronRight, FileText, FileUp, ImageUp, LoaderCircle, Sparkles, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/cn';
import { getPresentationDesignGuide } from '@/mocks/presentationGuides.mock';
import type {
  ContentDensity,
  PresentationIntent,
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
  onChange: (patch: Partial<PptMakerFormState>) => void;
  onTemplateSelect: (template: PptTemplate) => void;
  onSubmit: () => void;
}

export function PptMakerForm({ form, templates, isLoading, onChange, onTemplateSelect, onSubmit }: PptMakerFormProps) {
  const selectedTemplateIndex = useMemo(() => {
    const index = templates.findIndex((template) => template.id === form.selectedTemplateId);
    return index >= 0 ? index : 0;
  }, [form.selectedTemplateId, templates]);
  const [activeTemplateIndex, setActiveTemplateIndex] = useState(selectedTemplateIndex);
  const [sourceFileError, setSourceFileError] = useState<string | null>(null);
  const [isExtractingSource, setIsExtractingSource] = useState(false);
  const activeTemplate = templates[activeTemplateIndex] ?? templates[0];
  const presentationGuide = getPresentationDesignGuide(form.presentationIntent);
  const isActiveTemplateSelected = activeTemplate ? form.selectedTemplateId === activeTemplate.id : false;
  const hasStyleReference =
    form.styleSourceMode === 'template' ? Boolean(form.selectedTemplateId) : Boolean(form.styleImageDataUrl);
  const canSubmit = form.sourceText.trim().length >= 40 && hasStyleReference && !isLoading;

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

  const handleSourceDocumentChange = async (file: File | undefined) => {
    if (!file) {
      return;
    }

    setIsExtractingSource(true);
    setSourceFileError(null);
    try {
      const extracted = await extractSourceDocument(file);
      onChange({ sourceText: extracted.text, sourceDocument: extracted.document });
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

  const showPreviousTemplate = () => {
    setActiveTemplateIndex((currentIndex) => (currentIndex === 0 ? templates.length - 1 : currentIndex - 1));
  };

  const showNextTemplate = () => {
    setActiveTemplateIndex((currentIndex) => (currentIndex + 1) % templates.length);
  };

  return (
    <Card>
      <CardHeader>
        <h2 className="text-base font-bold text-primary">Source and style</h2>
        <p className="mt-1 text-sm text-text-subtle">
          Paste lecture notes or slide text, then define the audience and style language.
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="block text-sm font-semibold text-text-main">Source</span>
            <label className="inline-flex cursor-pointer items-center gap-2 rounded-md border border-border bg-surface px-3 py-2 text-sm font-semibold text-text-subtle transition hover:border-primary hover:text-primary">
              {isExtractingSource ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <FileUp className="h-4 w-4" />}
              {isExtractingSource ? 'Reading document...' : 'Upload DOCX, PDF, or PPTX'}
              <input
                aria-label="Source document"
                className="sr-only"
                type="file"
                accept=".docx,.pdf,.pptx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.openxmlformats-officedocument.presentationml.presentation"
                disabled={isExtractingSource}
                onChange={(event) => {
                  void handleSourceDocumentChange(event.target.files?.[0]);
                  event.currentTarget.value = '';
                }}
              />
            </label>
          </div>
          <Textarea
            aria-label="Source text"
            value={form.sourceText}
            placeholder="Paste source material or upload a DOCX, PDF, or PPTX file..."
            onChange={(event) => onChange({ sourceText: event.target.value })}
          />
          {form.sourceDocument ? (
            <div className="flex items-center gap-2 rounded-md border border-border bg-surface-muted px-3 py-2 text-sm text-text-subtle">
              <FileText className="h-4 w-4 text-primary" />
              <span className="min-w-0 flex-1 truncate">{form.sourceDocument.name}</span>
              <span className="shrink-0 text-xs">{form.sourceDocument.extractedCharacterCount.toLocaleString()} characters extracted</span>
              <Button
                type="button"
                variant="ghost"
                className="h-7 w-7 px-0"
                onClick={() => onChange({ sourceDocument: null })}
                aria-label="Remove source document"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          ) : null}
          {sourceFileError ? <p className="text-sm font-medium text-accent">{sourceFileError}</p> : null}
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
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
            <span className="mb-1 block text-sm font-semibold text-text-main">Presentation format</span>
            <select
              className="h-10 w-full rounded-md border border-border bg-surface px-3 text-sm outline-none focus:border-primary"
              value={form.presentationIntent ?? 'education-lecture'}
              onChange={(event) => onChange({ presentationIntent: event.target.value as PresentationIntent })}
            >
              <option value="executive-proposal">B2B executive proposal</option>
              <option value="strategy-decision">Strategy decision deck</option>
              <option value="education-lecture">Education lecture</option>
              <option value="investment-deck">Investment or IR deck</option>
              <option value="implementation-roadmap">Implementation roadmap</option>
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
          <p className="text-xs font-bold uppercase tracking-wide text-accent">Default planning and design guide</p>
          <h3 className="mt-1 text-base font-bold text-primary">{presentationGuide.name}</h3>
          <p className="mt-2 text-sm leading-6 text-text-main">{presentationGuide.narrativeGuide}</p>
          <p className="mt-2 text-sm leading-6 text-text-subtle">{presentationGuide.visualGuide}</p>
          <ul className="mt-3 grid gap-2 text-sm text-text-subtle sm:grid-cols-3">
            {presentationGuide.slideRules.map((rule) => (
              <li key={rule} className="rounded-md border border-border bg-surface px-3 py-2">
                {rule}
              </li>
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
