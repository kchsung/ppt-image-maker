import { Check, ImageUp, Sparkles, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/cn';
import type { PptMakerFormState, PptTemplate, StyleSourceMode, TargetLanguage } from '@/types/models/pptMaker.model';

interface PptMakerFormProps {
  form: PptMakerFormState;
  templates: PptTemplate[];
  isLoading: boolean;
  onChange: (patch: Partial<PptMakerFormState>) => void;
  onTemplateSelect: (template: PptTemplate) => void;
  onSubmit: () => void;
}

export function PptMakerForm({ form, templates, isLoading, onChange, onTemplateSelect, onSubmit }: PptMakerFormProps) {
  const hasStyleReference =
    form.styleSourceMode === 'template' ? Boolean(form.selectedTemplateId) : Boolean(form.styleImageDataUrl);
  const canSubmit = form.sourceText.trim().length >= 40 && hasStyleReference && !isLoading;

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

  const setSourceMode = (styleSourceMode: StyleSourceMode) => {
    onChange({ styleSourceMode });
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
        <label className="block">
          <span className="mb-1 block text-sm font-semibold text-text-main">Source text</span>
          <Textarea
            aria-label="Source text"
            value={form.sourceText}
            placeholder="Paste source material here..."
            onChange={(event) => onChange({ sourceText: event.target.value })}
          />
        </label>

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
              max={20}
              type="number"
              value={form.slideCount}
              onChange={(event) => onChange({ slideCount: Number(event.target.value) })}
            />
          </label>
        </div>

        <label className="block">
          <span className="mb-1 block text-sm font-semibold text-text-main">Style reference notes</span>
          <Textarea
            aria-label="Style reference notes"
            className="min-h-24"
            value={form.styleNotes}
            onChange={(event) => onChange({ styleNotes: event.target.value })}
          />
        </label>

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

          {form.styleSourceMode === 'template' ? (
            <div className="grid max-h-[560px] gap-3 overflow-y-auto rounded-md border border-border bg-surface-muted p-3 sm:grid-cols-2 xl:grid-cols-3">
              {templates.map((template) => {
                const isSelected = form.selectedTemplateId === template.id;
                return (
                  <button
                    key={template.id}
                    type="button"
                    className={cn(
                      'group overflow-hidden rounded-md border bg-surface text-left transition hover:border-primary',
                      isSelected ? 'border-primary ring-2 ring-primary/20' : 'border-border',
                    )}
                    onClick={() => onTemplateSelect(template)}
                  >
                    <div className="relative">
                      <img src={template.imageUrl} alt={template.label} className="aspect-video w-full object-cover" />
                      <span className="absolute left-2 top-2 rounded-full bg-primary px-2 py-1 text-xs font-bold text-white">
                        {template.label}
                      </span>
                      {isSelected ? (
                        <span className="absolute right-2 top-2 rounded-full bg-accent p-1 text-white">
                          <Check className="h-3.5 w-3.5" />
                        </span>
                      ) : null}
                    </div>
                    <div className="p-3">
                      <p className="text-sm font-bold text-text-main">{template.name}</p>
                      <p className="mt-1 line-clamp-2 text-xs leading-5 text-text-subtle">{template.description}</p>
                    </div>
                  </button>
                );
              })}
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
                    <p className="text-xs text-text-subtle">Used by the OpenAI image generation Edge Function.</p>
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
          {isLoading ? 'Generating...' : 'Generate PPT images'}
        </Button>
      </CardContent>
    </Card>
  );
}
