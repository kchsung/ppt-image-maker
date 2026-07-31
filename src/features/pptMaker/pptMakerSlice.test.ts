import { describe, expect, it } from 'vitest';
import { analyzePptRequest, generateDeckPlan, pptMakerReducer, resetDeckPlan, toPptMakerRequest, updateForm } from '@/features/pptMaker/pptMakerSlice';
import { samplePptMakerRequest } from '@/mocks/pptMaker.mock';
import { defaultPptTemplate } from '@/mocks/pptTemplates.mock';
import type { PptMakerFormState } from '@/types/models/pptMaker.model';

const sampleForm: PptMakerFormState = {
  sourceText: samplePptMakerRequest.sourceText,
  sourceDocument: null,
  sourceAttachments: [],
  sourceMaterialAnalysis: null,
  creationInstructions: '',
  targetLanguage: samplePptMakerRequest.targetLanguage,
  topic: '',
  audience: samplePptMakerRequest.audience,
  purpose: samplePptMakerRequest.purpose,
  presentationDurationMinutes: null,
  documentType: 'lecture',
  slideCount: samplePptMakerRequest.slideCount,
  contentDensity: 'light',
  presentationIntent: 'education-lecture',
  purposeTemplateId: 'education-material',
  coreMessage: '',
  requiredSections: '',
  styleNotes: samplePptMakerRequest.styleReference.notes,
  styleSourceMode: 'template',
  selectedTemplateId: defaultPptTemplate.id,
  styleImageDataUrl: null,
  logoImageDataUrl: null,
  requestAnalysis: null,
  clarificationAnswers: {},
};

describe('pptMakerSlice', () => {
  it('updates form fields', () => {
    const state = pptMakerReducer(undefined, updateForm({ audience: 'founders' }));

    expect(state.form.audience).toBe('founders');
  });

  it('preserves document metadata and creation instructions in the planning request', () => {
    const request = toPptMakerRequest({
      ...sampleForm,
      sourceDocument: { name: 'lecture.pdf', type: 'pdf', extractedCharacterCount: 8142 },
      sourceAttachments: [{
        id: 'metrics', name: 'metrics.xlsx', type: 'xlsx', extractedCharacterCount: 242, tableCount: 1, imageCount: 0,
      }],
      sourceMaterialAnalysis: {
        summary: 'The spreadsheet provides adoption evidence.', keyPoints: ['Adoption is the central measure.'], dataPoints: ['Adoption: 72'], availableVisuals: [],
      },
      creationInstructions: 'Use a practical workshop flow and include a decision slide.',
      purposeTemplateId: 'business-proposal',
      presentationIntent: 'executive-proposal',
      coreMessage: 'Make verified enterprise knowledge available for accountable AI work.',
      requiredSections: 'Current risk, operating model, rollout roadmap, expected outcome',
    });

    expect(request.sourceDocument).toEqual({ name: 'lecture.pdf', type: 'pdf', extractedCharacterCount: 8142 });
    expect(request.sourceAttachments).toEqual(expect.arrayContaining([expect.objectContaining({ type: 'xlsx', tableCount: 1 })]));
    expect(request.sourceMaterialAnalysis?.dataPoints).toContain('Adoption: 72');
    expect(request.creationInstructions).toBe('Use a practical workshop flow and include a decision slide.');
    expect(request.styleReference.templateDesign?.signatureLayout).toContain('industrial process cards');
    expect(request.contentDensity).toBe('light');
    expect(request.presentationGuide?.name).toBe('B2B Executive Proposal');
    expect(request.coreMessage).toContain('verified enterprise knowledge');
    expect(request.requiredSections).toContain('rollout roadmap');
  });

  it('uses the selected purpose template as the controlling document and story contract', () => {
    const request = toPptMakerRequest({
      ...sampleForm,
      purposeTemplateId: 'ir',
      audience: '',
      purpose: '',
      requiredSections: 'Investor proof points',
    });

    expect(request.documentType).toBe('investment');
    expect(request.presentationIntent).toBe('investment-deck');
    expect(request.purposeTemplate?.id).toBe('ir');
    expect(request.requiredSections).toContain('Investment thesis');
    expect(request.requiredSections).toContain('Investor proof points');
  });

  it('stores analyzed production conditions in the form before deck generation', () => {
    const action = analyzePptRequest.fulfilled(
      {
        topic: 'Trusted AI knowledge',
        purpose: 'Approve a pilot',
        audience: 'Executive sponsors',
        presentationDurationMinutes: 30,
        slideCount: 17,
        documentType: 'proposal',
        presentationIntent: 'executive-proposal',
        contentDensity: 'standard',
        coreMessage: 'Trusted knowledge makes AI adoption accountable.',
        requiredSections: 'Challenge, model, proof, rollout, decision',
        rationale: ['30 minutes supports 17 standard-detail slides.'],
        sourceMaterialAnalysis: { summary: 'Source supports a governed pilot.', keyPoints: ['Governed pilot'], dataPoints: [], availableVisuals: [] },
        clarifyingQuestions: [],
      },
      'analysis-request-1',
      sampleForm,
    );

    const state = pptMakerReducer(undefined, action);

    expect(state.analysisStatus).toBe('succeeded');
    expect(state.form.topic).toBe('Trusted AI knowledge');
    expect(state.form.presentationDurationMinutes).toBe(30);
    expect(state.form.slideCount).toBe(17);
    expect(state.form.requestAnalysis?.documentType).toBe('lecture');
    expect(state.form.presentationIntent).toBe('education-lecture');
  });

  it('stores generated deck plans', () => {
    const fulfilledAction = generateDeckPlan.fulfilled(
      {
        id: 'deck-1',
        title: 'Deck',
        createdAt: '2026-07-16T00:00:00.000Z',
        request: samplePptMakerRequest,
        slides: [],
        copyQa: { status: 'passed', checks: [], issues: [] },
      },
      'request-1',
      sampleForm,
    );

    const state = pptMakerReducer(undefined, fulfilledAction);

    expect(state.status).toBe('succeeded');
    expect(state.deckPlan?.id).toBe('deck-1');
  });

  it('resets generated output', () => {
    const populatedState = pptMakerReducer(
      undefined,
      generateDeckPlan.fulfilled(
        {
          id: 'deck-1',
          title: 'Deck',
          createdAt: '2026-07-16T00:00:00.000Z',
          request: samplePptMakerRequest,
          slides: [],
          copyQa: { status: 'passed', checks: [], issues: [] },
        },
        'request-1',
        sampleForm,
      ),
    );

    const resetState = pptMakerReducer(populatedState, resetDeckPlan());

    expect(resetState.deckPlan).toBeNull();
    expect(resetState.status).toBe('idle');
  });
});
