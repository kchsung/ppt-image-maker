import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { PptMakerForm } from '@/components/pptMaker/PptMakerForm';
import { defaultPptTemplate, pptTemplates } from '@/mocks/pptTemplates.mock';
import type { PptMakerFormState } from '@/types/models/pptMaker.model';

const form: PptMakerFormState = {
  sourceText: 'A sufficiently detailed source explains why teams need a governed and reusable knowledge operating model for AI.',
  sourceDocument: null,
  sourceAttachments: [],
  sourceMaterialAnalysis: null,
  creationInstructions: '',
  targetLanguage: 'English',
  topic: 'Trusted AI knowledge',
  audience: 'Executive sponsors',
  purpose: 'Approve a governed pilot',
  presentationDurationMinutes: null,
  documentType: 'proposal',
  slideCount: 6,
  contentDensity: 'standard',
  presentationIntent: 'executive-proposal',
  purposeTemplateId: 'business-proposal',
  coreMessage: 'Trusted knowledge makes AI adoption accountable.',
  requiredSections: 'Challenge, model, proof, rollout, decision',
  styleNotes: defaultPptTemplate.description,
  styleSourceMode: 'template',
  selectedTemplateId: defaultPptTemplate.id,
  styleImageDataUrl: null,
  logoImageDataUrl: null,
  clarificationAnswers: {},
  requestAnalysis: {
    topic: 'Trusted AI knowledge',
    purpose: 'Approve a governed pilot',
    audience: 'Executive sponsors',
    presentationDurationMinutes: null,
    slideCount: 6,
    documentType: 'proposal',
    presentationIntent: 'executive-proposal',
    contentDensity: 'standard',
    coreMessage: 'Trusted knowledge makes AI adoption accountable.',
    requiredSections: 'Challenge, model, proof, rollout, decision',
    rationale: ['No duration is included in the source.', 'A duration is required to tune the deck length.'],
    sourceMaterialAnalysis: { summary: 'Source supports a governed knowledge model.', keyPoints: ['Govern knowledge'], dataPoints: [], availableVisuals: [] },
    clarifyingQuestions: [{
      id: 'duration',
      field: 'presentationDurationMinutes',
      question: 'How long is the presentation slot?',
      required: true,
      options: [{ label: '30 minutes', value: '30' }],
    }],
  },
};

describe('PptMakerForm required condition questions', () => {
  it('blocks deck creation until the required selection is applied to production conditions', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    const onSubmit = vi.fn();

    render(
      <PptMakerForm
        form={form}
        templates={pptTemplates}
        isLoading={false}
        isAnalyzingRequest={false}
        onChange={onChange}
        onAnalyzeRequest={vi.fn()}
        onTemplateSelect={vi.fn()}
        onSubmit={onSubmit}
      />,
    );

    expect(screen.getByRole('button', { name: /create ppt deck/i })).toBeDisabled();
    await user.click(screen.getByRole('button', { name: '30 minutes' }));

    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({
      presentationDurationMinutes: 30,
      slideCount: 17,
      clarificationAnswers: { duration: '30' },
    }));
  });

  it('requires uploaded source materials to be analyzed before deck creation', () => {
    render(
      <PptMakerForm
        form={{
          ...form,
          requestAnalysis: null,
          sourceAttachments: [{ id: 'metrics', name: 'metrics.xlsx', type: 'xlsx', extractedCharacterCount: 84, tableCount: 1, imageCount: 0 }],
        }}
        templates={pptTemplates}
        isLoading={false}
        isAnalyzingRequest={false}
        onChange={vi.fn()}
        onAnalyzeRequest={vi.fn()}
        onTemplateSelect={vi.fn()}
        onSubmit={vi.fn()}
      />,
    );

    expect(screen.getByText(/analyze the uploaded materials/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /create ppt deck/i })).toBeDisabled();
  });

  it('applies the selected purpose template as a complete planning patch', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();

    render(
      <PptMakerForm
        form={form}
        templates={pptTemplates}
        isLoading={false}
        isAnalyzingRequest={false}
        onChange={onChange}
        onAnalyzeRequest={vi.fn()}
        onTemplateSelect={vi.fn()}
        onSubmit={vi.fn()}
      />,
    );

    await user.selectOptions(screen.getByLabelText('PPT purpose template'), 'ir');

    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({
      purposeTemplateId: 'ir',
      documentType: 'investment',
      presentationIntent: 'investment-deck',
      requestAnalysis: null,
    }));
  });
});
