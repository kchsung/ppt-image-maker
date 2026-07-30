import { useState } from 'react';
import { FileInput, PanelTop, RotateCcw } from 'lucide-react';
import { toast } from 'sonner';
import { PageHeader } from '@/components/common/PageHeader';
import { GenerationProgressPanel } from '@/components/pptMaker/GenerationProgressPanel';
import { GeneratedPptDeckPanel } from '@/components/pptMaker/GeneratedPptDeckPanel';
import { PptDomExportDeck } from '@/components/pptMaker/PptDomExportDeck';
import { PptMakerForm } from '@/components/pptMaker/PptMakerForm';
import { Button } from '@/components/ui/button';
import {
  enhanceGeneratedPptDocument,
  generateDeckPlan,
  registerPresentationJob,
  resetDeckPlan,
  updateForm,
} from '@/features/pptMaker/pptMakerSlice';
import { useAppDispatch, useAppSelector } from '@/hooks/redux';
import { getTemplateDesignProfile, pptTemplates } from '@/mocks/pptTemplates.mock';
import { pptExportService } from '@/services/pptExport.service';
import type { PptTemplate } from '@/types/models/pptMaker.model';

type PptMakerTab = 'input' | 'output';

export function PptMakerPage() {
  const dispatch = useAppDispatch();
  const [activeTab, setActiveTab] = useState<PptMakerTab>('input');
  const { form, deckPlan, documentEnhancement, status, documentStatus, error } = useAppSelector(
    (state) => state.pptMaker,
  );
  const isGenerating = status === 'loading' || documentStatus === 'loading';

  const handleSubmit = () => {
    setActiveTab('output');
    void dispatch(generateDeckPlan(form))
      .unwrap()
      .then(async (generatedDeckPlan) => {
        await dispatch(registerPresentationJob(generatedDeckPlan)).unwrap();
        return dispatch(enhanceGeneratedPptDocument(generatedDeckPlan)).unwrap();
      })
      .then(() => {
        toast.success('Editable PPTX layout is ready. Use Export PPTX to download it or generate it from the List page to save it to Supabase.');
      })
      .catch(() => toast.error('PPT generation failed.'));
  };

  const handleTemplateSelect = (template: PptTemplate) => {
    const design = getTemplateDesignProfile(template.id);
    dispatch(
      updateForm({
        styleSourceMode: 'template',
        selectedTemplateId: template.id,
        styleNotes: `Use ${template.label}: ${template.description}. Match its ${template.accentColorLabel} accent and signature composition: ${design?.signatureLayout ?? 'clean editorial card hierarchy'}. Prefer ${design?.recommendedVisualStructures.join(', ') ?? 'varied information structures'} when they fit the message, while keeping the deck varied.`,
      }),
    );
  };

  const handleExportPptx = () => {
    if (!deckPlan || !documentEnhancement) {
      toast.error('Wait for the Slide JSON and layout engine to finish.');
      return;
    }
    const exportRoot = document.querySelector<HTMLElement>(`[data-pptx-deck="${deckPlan.id}"]`);
    const slideElements = exportRoot ? Array.from(exportRoot.querySelectorAll<HTMLElement>('[data-pptx-slide]')) : [];

    void pptExportService
      .exportDeck(
        deckPlan,
        documentEnhancement,
        slideElements,
      )
      .then(() => toast.success('PPTX export started.'))
      .catch(() => toast.error('PPTX export failed.'));
  };

  return (
    <>
      <PageHeader
        eyebrow="QLEARN Startup"
        title="PPT Deck Maker"
        description="Choose a template or upload a sample style, then add source text or a DOCX, PDF, or PPTX file. QLEARN will create a Slide JSON plan, varied layouts, and an editable PPTX output."
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
          <PanelTop className="h-4 w-4" />
          Output
          {deckPlan ? <span className="ml-1 rounded-full bg-white/20 px-1.5 text-xs">{deckPlan.slides.length}</span> : null}
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
          planStatus={status}
        />
      ) : (
        <GeneratedPptDeckPanel
          deckPlan={deckPlan}
          documentEnhancement={documentEnhancement}
          onExportPptx={handleExportPptx}
        />
      )}
      {deckPlan ? <PptDomExportDeck deckPlan={deckPlan} deckId={deckPlan.id} /> : null}
    </>
  );
}
