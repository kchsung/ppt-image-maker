import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Provider } from 'react-redux';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { configureStore } from '@reduxjs/toolkit';
import { pptMakerReducer } from '@/features/pptMaker/pptMakerSlice';
import { samplePptMakerRequest } from '@/mocks/pptMaker.mock';
import { PptAdminPage } from '@/pages/pptAdmin/PptAdminPage';
import type { PptDeckPlan } from '@/types/models/pptMaker.model';

const mocks = vi.hoisted(() => ({
  listGenerationJobs: vi.fn(),
  retryGenerationItem: vi.fn(),
  savePptxOutput: vi.fn(),
  deleteGenerationJob: vi.fn(),
  enhancePptDocument: vi.fn(),
  createImageDeckBlob: vi.fn(),
}));

vi.mock('@/services/pptAdmin.service', () => ({ pptAdminService: mocks }));
vi.mock('@/services/pptDocument.service', () => ({ enhancePptDocument: mocks.enhancePptDocument }));
vi.mock('@/services/pptExport.service', () => ({ pptExportService: { createImageDeckBlob: mocks.createImageDeckBlob } }));

const deckPlan: PptDeckPlan = {
  id: 'native-deck',
  title: 'Native PPTX deck',
  createdAt: '2026-07-18T00:00:00.000Z',
  request: samplePptMakerRequest,
  slides: [{
    id: 'slide-1',
    pageNumber: 1,
    archetype: 'cover',
    visualStructure: 'hero-visual',
    mainMessage: 'A clear message.',
    title: 'Native title',
    subtitle: 'Native subtitle',
    labels: ['Label'],
    takeaway: 'Native takeaway',
    imagePrompt: 'Prompt',
  }],
  copyQa: { status: 'passed', checks: ['Copy passed.'], issues: [] },
};

describe('PptAdminPage native PPTX output', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.listGenerationJobs.mockResolvedValue({
      jobs: [{
        id: 'native-job',
        title: deckPlan.title,
        status: 'succeeded',
        progress: 100,
        totalItems: 1,
        completedItems: 1,
        createdAt: '2026-07-18T00:00:00.000Z',
        updatedAt: '2026-07-18T00:00:00.000Z',
        errorMessage: null,
        deckPlan,
        resultPath: null,
        pptxUrl: null,
        items: [{
          id: 'native-item',
          pageNumber: 1,
          status: 'succeeded',
          outputPath: 'ppt-generations/native-job/slide-01.png',
          imageUrl: 'https://example.com/slide-01.png',
          errorMessage: null,
          updatedAt: '2026-07-18T00:00:00.000Z',
        }],
      }],
    });
    mocks.enhancePptDocument.mockResolvedValue({
      title: deckPlan.title,
      fileName: 'native-deck.pptx',
      pptxUrl: 'https://example.com/native-deck.pptx',
      resultPath: 'ppt-generations/native-job/final/native-deck.pptx',
      generationMode: 'claude-native',
      speakerNotes: [],
      qaChecklist: [],
      layouts: [],
      layoutSource: 'claude',
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('uses the Claude-native file and never rebuilds a full-slide image export', async () => {
    const store = configureStore({ reducer: { pptMaker: pptMakerReducer } });
    const user = userEvent.setup();
    render(<Provider store={store}><MemoryRouter><PptAdminPage /></MemoryRouter></Provider>);

    await user.click(await screen.findByRole('button', { name: 'Generate PPTX' }));

    await waitFor(() => expect(mocks.enhancePptDocument).toHaveBeenCalledTimes(1));
    expect(mocks.createImageDeckBlob).not.toHaveBeenCalled();
    expect(mocks.savePptxOutput).not.toHaveBeenCalled();
  });

  it('allows an in-progress PPTX job to be restarted after confirmation', async () => {
    const now = new Date().toISOString();
    mocks.listGenerationJobs.mockResolvedValue({
      jobs: [{
        id: 'native-job',
        title: deckPlan.title,
        status: 'succeeded',
        progress: 100,
        totalItems: 1,
        completedItems: 1,
        createdAt: now,
        updatedAt: now,
        errorMessage: null,
        deckPlan,
        resultPath: null,
        pptxUrl: null,
        pptxStatus: 'processing',
        pptxUpdatedAt: now,
        pptxProgress: 35,
        pptxPhase: 'Claude is rebuilding editable slides',
        pptxExecutor: 'netlify-worker',
        items: [{
          id: 'native-item',
          pageNumber: 1,
          status: 'succeeded',
          outputPath: 'ppt-generations/native-job/slide-01.png',
          imageUrl: 'https://example.com/slide-01.png',
          errorMessage: null,
          updatedAt: now,
        }],
      }],
    });
    mocks.enhancePptDocument.mockResolvedValue({
      title: deckPlan.title,
      fileName: 'native-deck.pptx',
      generationMode: 'claude-native-pending',
      pptxStatus: 'processing',
      speakerNotes: [],
      qaChecklist: [],
      layouts: [],
      layoutSource: 'claude',
    });
    vi.spyOn(window, 'confirm').mockReturnValue(true);

    const store = configureStore({ reducer: { pptMaker: pptMakerReducer } });
    const user = userEvent.setup();
    render(<Provider store={store}><MemoryRouter><PptAdminPage /></MemoryRouter></Provider>);

    const restartButton = await screen.findByRole('button', { name: 'Restart PPTX' });
    expect(restartButton).toBeEnabled();
    await user.click(restartButton);

    await waitFor(() => expect(mocks.enhancePptDocument).toHaveBeenCalledTimes(1));
  });
});
