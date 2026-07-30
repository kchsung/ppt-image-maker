import { createAsyncThunk, createSlice, type PayloadAction } from '@reduxjs/toolkit';
import { defaultPptTemplate, getTemplateDesignProfile, pptTemplates } from '@/mocks/pptTemplates.mock';
import { getPresentationDesignGuide } from '@/mocks/presentationGuides.mock';
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
  generationJobId: string | null;
  documentEnhancement: PptDocumentEnhancement | null;
  status: 'idle' | 'loading' | 'succeeded' | 'failed';
  imageStatus: 'idle' | 'loading' | 'succeeded' | 'failed';
  documentStatus: 'idle' | 'loading' | 'succeeded' | 'failed';
  error: string | null;
}

const initialState: PptMakerState = {
  form: {
    sourceText: '',
    sourceDocument: null,
    creationInstructions: '',
    targetLanguage: 'English',
    audience: 'university students',
    purpose: 'summer school lecture',
    slideCount: 6,
    contentDensity: 'light',
    presentationIntent: 'education-lecture',
    coreMessage: '',
    requiredSections: '',
    styleNotes: `${defaultStyleReference.notes} Use ${defaultPptTemplate.label}: ${defaultPptTemplate.description}`,
    styleSourceMode: 'template',
    selectedTemplateId: defaultPptTemplate.id,
    styleImageDataUrl: null,
    logoImageDataUrl: null,
  },
  deckPlan: null,
  imageDeck: null,
  generationJobId: null,
  documentEnhancement: null,
  status: 'idle',
  imageStatus: 'idle',
  documentStatus: 'idle',
  error: null,
};

export function toPptMakerRequest(form: PptMakerFormState): PptMakerRequest {
  const selectedTemplate = form.selectedTemplateId
    ? pptTemplates.find((template) => template.id === form.selectedTemplateId)
    : undefined;
  const usesTemplate = form.styleSourceMode === 'template' && selectedTemplate;
  const presentationIntent = form.presentationIntent ?? 'education-lecture';
  const presentationGuide = getPresentationDesignGuide(presentationIntent);
  const getTrimmedText = (value: unknown) => typeof value === 'string' ? value.trim() : '';
  const sourceText = getTrimmedText(form.sourceText);
  const slideCount = Number.isFinite(form.slideCount) ? Math.min(100, Math.max(2, form.slideCount)) : 6;

  return {
    sourceText,
    sourceDocument: form.sourceDocument ?? undefined,
    creationInstructions: getTrimmedText(form.creationInstructions) || undefined,
    targetLanguage: form.targetLanguage,
    audience: getTrimmedText(form.audience) || 'General audience',
    purpose: getTrimmedText(form.purpose) || 'Business presentation',
    slideCount,
    contentDensity: form.contentDensity,
    presentationIntent,
    coreMessage: getTrimmedText(form.coreMessage) || undefined,
    requiredSections: getTrimmedText(form.requiredSections) || undefined,
    presentationGuide,
    styleReference: {
      ...defaultStyleReference,
      id: usesTemplate ? selectedTemplate.id : defaultStyleReference.id,
      name: usesTemplate ? selectedTemplate.name : defaultStyleReference.name,
      notes: form.styleNotes,
      accentColorLabel: usesTemplate ? selectedTemplate.accentColorLabel : defaultStyleReference.accentColorLabel,
      templateDesign: usesTemplate ? getTemplateDesignProfile(selectedTemplate.id) : undefined,
    },
    styleImageDataUrl: form.styleSourceMode === 'upload' ? (form.styleImageDataUrl ?? undefined) : undefined,
    styleImageUrl: usesTemplate ? selectedTemplate.imageUrl : undefined,
    selectedTemplateId: usesTemplate ? selectedTemplate.id : undefined,
    logoImageDataUrl: form.logoImageDataUrl ?? undefined,
  };
}

export const generateDeckPlan = createAsyncThunk('pptMaker/generateDeckPlan', async (form: PptMakerFormState) => {
  return pptMakerService.generateDeckPlan(toPptMakerRequest(form));
});

export const generateSlideImages = createAsyncThunk(
  'pptMaker/generateSlideImages',
  async (deckPlan: PptDeckPlan, { dispatch }) => {
    return pptMakerService.generateSlideImages(deckPlan, (image) => {
      dispatch(appendGeneratedSlideImage(image));
    });
  },
);

export const registerPresentationJob = createAsyncThunk(
  'pptMaker/registerPresentationJob',
  async (deckPlan: PptDeckPlan) => pptMakerService.createGenerationJob(deckPlan),
);

export const enhanceGeneratedPptDocument = createAsyncThunk(
  'pptMaker/enhanceGeneratedPptDocument',
  async (deckPlan: PptDeckPlan) => enhancePptDocument(deckPlan),
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
      state.generationJobId = null;
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
        state.generationJobId = null;
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
      .addCase(registerPresentationJob.pending, (state) => {
        state.error = null;
      })
      .addCase(registerPresentationJob.fulfilled, (state, action) => {
        state.generationJobId = action.payload?.id ?? null;
      })
      .addCase(registerPresentationJob.rejected, (state, action) => {
        state.error = action.error.message ?? 'Presentation registration failed.';
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
