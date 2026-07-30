import { useState } from 'react';
import { FileInput, Images, RotateCcw } from 'lucide-react';
import { toast } from 'sonner';
import { PageHeader } from '@/components/common/PageHeader';
import { GenerationProgressPanel } from '@/components/pptMaker/GenerationProgressPanel';
import { GeneratedImageDeckPanel } from '@/components/pptMaker/GeneratedImageDeckPanel';
import { PptMakerForm } from '@/components/pptMaker/PptMakerForm';
import { Button } from '@/components/ui/button';
import {
  enhanceGeneratedPptDocument,
  generateDeckPlan,
  generateSlideImages,
  resetDeckPlan,
  updateForm,
} from '@/features/pptMaker/pptMakerSlice';
import { useAppDispatch, useAppSelector } from '@/hooks/redux';
import { pptTemplates } from '@/mocks/pptTemplates.mock';
import { pptExportService } from '@/services/pptExport.service';
import type { PptTemplate } from '@/types/models/pptMaker.model';

type PptMakerTab = 'input' | 'output';

export function PptMakerPage() {
  const dispatch = useAppDispatch();
  const [activeTab, setActiveTab] = useState<PptMakerTab>('input');
  const { form, deckPlan, imageDeck, documentEnhancement, status, imageStatus, documentStatus, error } = useAppSelector(
    (state) => state.pptMaker,
  );
  const isGenerating = status === 'loading' || imageStatus === 'loading' || documentStatus === 'loading';

  const handleSubmit = () => {
    setActiveTab('output');
    void dispatch(generateDeckPlan(form))
      .unwrap()
      .then((generatedDeckPlan) =>
        dispatch(generateSlideImages(generatedDeckPlan))
          .unwrap()
          .then((generatedImageDeck) => ({ generatedDeckPlan, generatedImageDeck })),
      )
      .then(({ generatedDeckPlan, generatedImageDeck }) =>
        dispatch(enhanceGeneratedPptDocument({ deckPlan: generatedDeckPlan, imageDeck: generatedImageDeck })).unwrap(),
      )
      .then((enhancement) => {
        toast.success(
          enhancement.pptxStatus === 'processing'
            ? 'PPTX generation started. Check the List page when it is ready.'
            : 'Editable PPTX generated.',
        );
      })
      .catch(() => toast.error('PPT generation failed.'));
  };

  const handleTemplateSelect = (template: PptTemplate) => {
    dispatch(
      updateForm({
        styleSourceMode: 'template',
        selectedTemplateId: template.id,
        styleNotes: `Use ${template.label}: ${template.description}. Match its ${template.accentColorLabel} accent, clean white background, card flow, circular outcome area, footer, and page-number treatment.`,
      }),
    );
  };

  const handleExportPptx = () => {
    if (!imageDeck || !documentEnhancement) {
      toast.error('Wait for PptxGenJS to finish the final editable PPTX.');
      return;
    }

    if (documentEnhancement?.pptxUrl) {
      const link = document.createElement('a');
      link.href = documentEnhancement.pptxUrl;
      link.download = documentEnhancement.fileName;
      link.rel = 'noopener';
      document.body.appendChild(link);
      link.click();
      link.remove();
      return;
    }

    if (documentEnhancement.generationMode !== 'browser-fallback') {
      toast.error('The native PPTX file is not available. Generate the document again from the List page.');
      return;
    }

    void pptExportService
      .exportImageDeck(
        imageDeck,
        deckPlan,
        documentEnhancement?.fileName ?? 'qlearn-editable-deck.pptx',
        documentEnhancement ?? undefined,
      )
      .then(() => toast.success('PPTX export started.'))
      .catch(() => toast.error('PPTX export failed.'));
  };

  const handlePreviewPptx = () => {
    if (!documentEnhancement?.pptxUrl) {
      return;
    }

    const viewerUrl = `https://view.officeapps.live.com/op/view.aspx?src=${encodeURIComponent(documentEnhancement.pptxUrl)}`;
    window.open(viewerUrl, '_blank', 'noopener,noreferrer');
  };

  return (
    <>
      <PageHeader
        eyebrow="QLEARN Startup"
        title="PPT Image Deck Maker"
        description="Choose a numbered template or upload a sample slide style, then paste source text. QLEARN will draft editable slides, generate visual assets, and assemble a PPTX output."
        actions={
          <Button
            variant="secondary"
            onClick={() => {
              dispatch(resetDeckPlan());
              setActiveTab('input');
            }}
          >
            <RotateCcw className="h-4 w-4" />
            Reset result
          </Button>
        }
      />
      {error ? (
        <div className="mb-4 rounded-md border border-border bg-accent-muted px-4 py-3 text-sm font-semibold text-accent">
          {error}
        </div>
      ) : null}

      <div className="mb-5 inline-flex rounded-lg border border-border bg-surface p-1 shadow-sm">
        <Button
          variant={activeTab === 'input' ? 'primary' : 'ghost'}
          className="h-9 rounded-md"
          onClick={() => setActiveTab('input')}
        >
          <FileInput className="h-4 w-4" />
          Input
        </Button>
        <Button
          variant={activeTab === 'output' ? 'primary' : 'ghost'}
          className="h-9 rounded-md"
          onClick={() => setActiveTab('output')}
        >
          <Images className="h-4 w-4" />
          Output
          {imageDeck ? <span className="ml-1 rounded-full bg-white/20 px-1.5 text-xs">{imageDeck.images.length}</span> : null}
        </Button>
      </div>

      {activeTab === 'input' ? (
        <PptMakerForm
          form={form}
          templates={pptTemplates}
          isLoading={isGenerating}
          onChange={(patch) => dispatch(updateForm(patch))}
          onTemplateSelect={handleTemplateSelect}
          onSubmit={handleSubmit}
        />
      ) : isGenerating ? (
        <GenerationProgressPanel
          deckPlan={deckPlan}
          documentEnhancement={documentEnhancement}
          documentStatus={documentStatus}
          imageDeck={imageDeck}
          imageStatus={imageStatus}
          planStatus={status}
        />
      ) : (
        <GeneratedImageDeckPanel
          imageDeck={imageDeck}
          documentEnhancement={documentEnhancement}
          logoImageDataUrl={deckPlan?.request.logoImageDataUrl}
          onExportPptx={handleExportPptx}
          onPreviewPptx={handlePreviewPptx}
        />
      )}
    </>
  );
}
