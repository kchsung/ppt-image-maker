import { describe, expect, it } from 'vitest';
import { generateDeckPlan, pptMakerReducer, resetDeckPlan, toPptMakerRequest, updateForm } from '@/features/pptMaker/pptMakerSlice';
import { samplePptMakerRequest } from '@/mocks/pptMaker.mock';
import { defaultPptTemplate } from '@/mocks/pptTemplates.mock';
import type { PptMakerFormState } from '@/types/models/pptMaker.model';

const sampleForm: PptMakerFormState = {
  sourceText: samplePptMakerRequest.sourceText,
  sourceDocument: null,
  creationInstructions: '',
  targetLanguage: samplePptMakerRequest.targetLanguage,
  audience: samplePptMakerRequest.audience,
  purpose: samplePptMakerRequest.purpose,
  slideCount: samplePptMakerRequest.slideCount,
  contentDensity: 'light',
  presentationIntent: 'education-lecture',
  coreMessage: '',
  requiredSections: '',
  styleNotes: samplePptMakerRequest.styleReference.notes,
  styleSourceMode: 'template',
  selectedTemplateId: defaultPptTemplate.id,
  styleImageDataUrl: null,
  logoImageDataUrl: null,
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
      creationInstructions: 'Use a practical workshop flow and include a decision slide.',
      presentationIntent: 'executive-proposal',
      coreMessage: 'Make verified enterprise knowledge available for accountable AI work.',
      requiredSections: 'Current risk, operating model, rollout roadmap, expected outcome',
    });

    expect(request.sourceDocument).toEqual({ name: 'lecture.pdf', type: 'pdf', extractedCharacterCount: 8142 });
    expect(request.creationInstructions).toBe('Use a practical workshop flow and include a decision slide.');
    expect(request.styleReference.templateDesign?.signatureLayout).toContain('industrial process cards');
    expect(request.contentDensity).toBe('light');
    expect(request.presentationGuide?.name).toBe('B2B Executive Proposal');
    expect(request.coreMessage).toContain('verified enterprise knowledge');
    expect(request.requiredSections).toContain('rollout roadmap');
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
