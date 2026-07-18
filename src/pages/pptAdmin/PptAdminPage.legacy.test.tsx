import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Provider } from 'react-redux';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { store } from '@/app/store';
import { resetDeckPlan } from '@/features/pptMaker/pptMakerSlice';
import { samplePptMakerRequest } from '@/mocks/pptMaker.mock';
import { PptAdminPage } from '@/pages/pptAdmin/PptAdminPage';
import type { PptDeckPlan } from '@/types/models/pptMaker.model';

const mocks = vi.hoisted(() => ({
  listGenerationJobs: vi.fn(),
  retryGenerationItem: vi.fn(),
  savePptxOutput: vi.fn(),
  deleteGenerationJob: vi.fn(),
}));

const legacyDeckPlan: PptDeckPlan = {
  id: 'legacy-deck-plan',
  title: 'Broken legacy title',
  createdAt: '2026-07-18T00:00:00.000Z',
  request: {
    ...samplePptMakerRequest,
    sourceText: 'Original input that should be restored before rebuilding this presentation.',
  },
  slides: [],
  copyQa: {
    status: 'needs-review',
    checks: [],
    issues: ['Legacy deck plan did not run Claude copy QA.'],
  },
};

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

describe('PptAdminPage legacy generation protection', () => {
  beforeEach(() => {
    store.dispatch(resetDeckPlan());
    mocks.listGenerationJobs.mockResolvedValue({
      jobs: [{
        id: 'legacy-job',
        title: 'Broken legacy title',
        status: 'succeeded',
        progress: 100,
        totalItems: 1,
        completedItems: 1,
        createdAt: '2026-07-18T00:00:00.000Z',
        updatedAt: '2026-07-18T00:00:00.000Z',
        errorMessage: null,
        deckPlan: legacyDeckPlan,
        resultPath: null,
        pptxUrl: null,
        items: [{
          id: 'legacy-item',
          pageNumber: 1,
          status: 'succeeded',
          outputPath: 'ppt-generations/legacy-job/slide-01.png',
          imageUrl: null,
          errorMessage: null,
          updatedAt: '2026-07-18T00:00:00.000Z',
        }],
      }],
    });
  });

  it('restores inputs for a rebuild while blocking export and image regeneration', async () => {
    const user = userEvent.setup();
    render(
      <Provider store={store}>
        <MemoryRouter>
          <PptAdminPage />
        </MemoryRouter>
      </Provider>,
    );

    expect(await screen.findByText('Legacy generation - copy plan needs rebuild')).toBeInTheDocument();
    expect(screen.getByText('Legacy Copy')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Resume' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Rebuild in PPT Maker' })).toBeEnabled();
    expect(screen.getByRole('button', { name: 'Regenerate' })).toBeDisabled();

    await user.click(screen.getByRole('button', { name: 'Rebuild in PPT Maker' }));
    expect(store.getState().pptMaker.form.sourceText).toBe(legacyDeckPlan.request.sourceText);
    expect(store.getState().pptMaker.form.targetLanguage).toBe(legacyDeckPlan.request.targetLanguage);
  });
});
