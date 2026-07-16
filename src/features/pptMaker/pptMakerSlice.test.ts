import { describe, expect, it } from 'vitest';
import { generateDeckPlan, pptMakerReducer, resetDeckPlan, updateForm } from '@/features/pptMaker/pptMakerSlice';
import { samplePptMakerRequest } from '@/mocks/pptMaker.mock';
import type { PptMakerFormState } from '@/types/models/pptMaker.model';

const sampleForm: PptMakerFormState = {
  sourceText: samplePptMakerRequest.sourceText,
  targetLanguage: samplePptMakerRequest.targetLanguage,
  audience: samplePptMakerRequest.audience,
  purpose: samplePptMakerRequest.purpose,
  slideCount: samplePptMakerRequest.slideCount,
  styleNotes: samplePptMakerRequest.styleReference.notes,
  styleImageDataUrl: null,
};

describe('pptMakerSlice', () => {
  it('updates form fields', () => {
    const state = pptMakerReducer(undefined, updateForm({ audience: 'founders' }));

    expect(state.form.audience).toBe('founders');
  });

  it('stores generated deck plans', () => {
    const fulfilledAction = generateDeckPlan.fulfilled(
      {
        id: 'deck-1',
        title: 'Deck',
        createdAt: '2026-07-16T00:00:00.000Z',
        request: samplePptMakerRequest,
        slides: [],
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
