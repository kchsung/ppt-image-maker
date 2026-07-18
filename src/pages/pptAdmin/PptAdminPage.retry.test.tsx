import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Provider } from 'react-redux';
import { MemoryRouter } from 'react-router-dom';
import { configureStore } from '@reduxjs/toolkit';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { pptMakerReducer } from '@/features/pptMaker/pptMakerSlice';
import { samplePptMakerRequest } from '@/mocks/pptMaker.mock';
import { PptAdminPage } from '@/pages/pptAdmin/PptAdminPage';
import type { PptDeckPlan } from '@/types/models/pptMaker.model';

const mocks = vi.hoisted(() => ({
  listGenerationJobs: vi.fn(),
  retryGenerationItem: vi.fn(),
  savePptxOutput: vi.fn(),
  deleteGenerationJob: vi.fn(),
}));

vi.mock('@/services/pptAdmin.service', () => ({
  pptAdminService: mocks,
}));

vi.mock('@/services/pptDocument.service', () => ({
  enhancePptDocument: vi.fn(),
}));

vi.mock('@/services/pptExport.service', () => ({
  pptExportService: {
    createImageDeckBlob: vi.fn(),
  },
}));

const deckPlan: PptDeckPlan = {
  id: 'parallel-deck',
  title: 'Parallel image regeneration',
  createdAt: '2026-07-18T00:00:00.000Z',
  request: samplePptMakerRequest,
  slides: [],
  copyQa: { status: 'passed', checks: ['Claude copy QA passed.'], issues: [] },
};

describe('PptAdminPage queued image regeneration', () => {
  beforeEach(() => {
    mocks.listGenerationJobs.mockResolvedValue({
      jobs: [{
        id: 'parallel-job',
        title: 'Parallel image regeneration',
        status: 'processing',
        progress: 0,
        totalItems: 2,
        completedItems: 0,
        createdAt: '2026-07-18T00:00:00.000Z',
        updatedAt: '2026-07-18T00:00:00.000Z',
        errorMessage: null,
        deckPlan,
        resultPath: null,
        pptxUrl: null,
        items: [1, 2].map((pageNumber) => ({
          id: `parallel-item-${pageNumber}`,
          pageNumber,
          status: 'failed',
          outputPath: null,
          imageUrl: null,
          errorMessage: 'Previous attempt failed.',
          updatedAt: '2026-07-18T00:00:00.000Z',
        })),
      }],
    });
  });

  it('queues a second retry while the first image request is still running', async () => {
    mocks.retryGenerationItem.mockImplementation(() => new Promise<void>(() => undefined));

    const store = configureStore({ reducer: { pptMaker: pptMakerReducer } });
    const user = userEvent.setup();
    render(
      <Provider store={store}>
        <MemoryRouter>
          <PptAdminPage />
        </MemoryRouter>
      </Provider>,
    );

    const retryButtons = await screen.findAllByRole('button', { name: 'Retry' });
    expect(retryButtons).toHaveLength(2);

    await user.click(retryButtons[0]);
    await user.click(retryButtons[1]);

    expect(mocks.retryGenerationItem).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('button', { name: 'Waiting / generating' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Queued' })).toBeDisabled();
  });
});
