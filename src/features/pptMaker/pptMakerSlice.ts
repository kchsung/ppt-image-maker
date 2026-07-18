import { createAsyncThunk, createSlice, type PayloadAction } from '@reduxjs/toolkit';
import { defaultPptTemplate, pptTemplates } from '@/mocks/pptTemplates.mock';
import { defaultStyleReference } from '@/mocks/pptMaker.mock';
import { enhancePptDocument } from '@/services/pptDocument.service';
import { pptMakerService } from '@/services/pptMaker.service';
import type {
  GeneratedImageDeck,
  GeneratedSlideImage,
  PptDeckPlan,
  PptDocumentEnhancement,
  PptMakerFormState,
  PptMakerRequest,
} from '@/types/models/pptMaker.model';

interface PptMakerState {
  form: PptMakerFormState;
  deckPlan: PptDeckPlan | null;
  imageDeck: GeneratedImageDeck | null;
  documentEnhancement: PptDocumentEnhancement | null;
  status: 'idle' | 'loading' | 'succeeded' | 'failed';
  imageStatus: 'idle' | 'loading' | 'succeeded' | 'failed';
  documentStatus: 'idle' | 'loading' | 'succeeded' | 'failed';
  error: string | null;
}

const initialState: PptMakerState = {
  form: {
    sourceText: '',
    targetLanguage: 'English',
    audience: 'university students',
    purpose: 'summer school lecture',
    slideCount: 6,
    styleNotes: `${defaultStyleReference.notes} Use ${defaultPptTemplate.label}: ${defaultPptTemplate.description}`,
    styleSourceMode: 'template',
    selectedTemplateId: defaultPptTemplate.id,
    styleImageDataUrl: null,
    logoImageDataUrl: null,
  },
  deckPlan: null,
  imageDeck: null,
  documentEnhancement: null,
  status: 'idle',
  imageStatus: 'idle',
  documentStatus: 'idle',
  error: null,
};

function toRequest(form: PptMakerFormState): PptMakerRequest {
  const selectedTemplate = form.selectedTemplateId
    ? pptTemplates.find((template) => template.id === form.selectedTemplateId)
    : undefined;
  const usesTemplate = form.styleSourceMode === 'template' && selectedTemplate;

  return {
    sourceText: form.sourceText,
    targetLanguage: form.targetLanguage,
    audience: form.audience,
    purpose: form.purpose,
    slideCount: form.slideCount,
    styleReference: {
      ...defaultStyleReference,
      name: usesTemplate ? selectedTemplate.name : defaultStyleReference.name,
      notes: form.styleNotes,
      accentColorLabel: usesTemplate ? selectedTemplate.accentColorLabel : defaultStyleReference.accentColorLabel,
    },
    styleImageDataUrl: form.styleSourceMode === 'upload' ? (form.styleImageDataUrl ?? undefined) : undefined,
    styleImageUrl: usesTemplate ? selectedTemplate.imageUrl : undefined,
    selectedTemplateId: usesTemplate ? selectedTemplate.id : undefined,
    logoImageDataUrl: form.logoImageDataUrl ?? undefined,
  };
}

export const generateDeckPlan = createAsyncThunk('pptMaker/generateDeckPlan', async (form: PptMakerFormState) => {
  return pptMakerService.generateDeckPlan(toRequest(form));
});

export const generateSlideImages = createAsyncThunk(
  'pptMaker/generateSlideImages',
  async (deckPlan: PptDeckPlan, { dispatch }) => {
    return pptMakerService.generateSlideImages(deckPlan, (image) => {
      dispatch(appendGeneratedSlideImage(image));
    });
  },
);

export const enhanceGeneratedPptDocument = createAsyncThunk(
  'pptMaker/enhanceGeneratedPptDocument',
  async ({ deckPlan, imageDeck }: { deckPlan: PptDeckPlan; imageDeck: GeneratedImageDeck }) => {
    return enhancePptDocument(deckPlan, imageDeck);
  },
);

export const pptMakerSlice = createSlice({
  name: 'pptMaker',
  initialState,
  reducers: {
    updateForm(state, action: PayloadAction<Partial<PptMakerFormState>>) {
      state.form = { ...state.form, ...action.payload };
    },
    resetDeckPlan(state) {
      state.deckPlan = null;
      state.imageDeck = null;
      state.documentEnhancement = null;
      state.status = 'idle';
      state.imageStatus = 'idle';
      state.documentStatus = 'idle';
      state.error = null;
    },
    appendGeneratedSlideImage(state, action: PayloadAction<GeneratedSlideImage>) {
      if (!state.imageDeck && state.deckPlan) {
        state.imageDeck = {
          id: `image-deck-${state.deckPlan.id}`,
          deckPlanId: state.deckPlan.id,
          createdAt: new Date().toISOString(),
          images: [],
        };
      }

      if (!state.imageDeck) {
        return;
      }

      const nextImage = action.payload;
      const existingIndex = state.imageDeck.images.findIndex((image) => image.slideId === nextImage.slideId);
      if (existingIndex >= 0) {
        state.imageDeck.images[existingIndex] = nextImage;
      } else {
        state.imageDeck.images.push(nextImage);
      }
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(generateDeckPlan.pending, (state) => {
        state.status = 'loading';
        state.error = null;
      })
      .addCase(generateDeckPlan.fulfilled, (state, action) => {
        state.status = 'succeeded';
        state.deckPlan = action.payload;
        state.imageDeck = null;
        state.documentEnhancement = null;
      })
      .addCase(generateDeckPlan.rejected, (state, action) => {
        state.status = 'failed';
        state.error = action.error.message ?? 'Deck generation failed.';
      })
      .addCase(generateSlideImages.pending, (state, action) => {
        state.imageStatus = 'loading';
        state.error = null;
        state.imageDeck = {
          id: `image-deck-${action.meta.arg.id}`,
          deckPlanId: action.meta.arg.id,
          generationJobId: undefined,
          createdAt: new Date().toISOString(),
          images: [],
        };
      })
      .addCase(generateSlideImages.fulfilled, (state, action) => {
        state.imageStatus = 'succeeded';
        state.imageDeck = action.payload;
        state.documentEnhancement = null;
      })
      .addCase(generateSlideImages.rejected, (state, action) => {
        state.imageStatus = 'failed';
        state.error = action.error.message ?? 'Slide image generation failed.';
      })
      .addCase(enhanceGeneratedPptDocument.pending, (state) => {
        state.documentStatus = 'loading';
        state.error = null;
      })
      .addCase(enhanceGeneratedPptDocument.fulfilled, (state, action) => {
        state.documentStatus = 'succeeded';
        state.documentEnhancement = action.payload;
      })
      .addCase(enhanceGeneratedPptDocument.rejected, (state, action) => {
        state.documentStatus = 'failed';
        state.error = action.error.message ?? 'PPT document enhancement failed.';
      });
  },
});

export const { appendGeneratedSlideImage, updateForm, resetDeckPlan } = pptMakerSlice.actions;
export const pptMakerReducer = pptMakerSlice.reducer;
