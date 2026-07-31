import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Provider } from 'react-redux';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import { store } from '@/app/store';
import { createMockDeckPlan, samplePptMakerRequest } from '@/mocks/pptMaker.mock';
import { PptMakerPage } from '@/pages/pptMaker/PptMakerPage';
import { pptMakerService } from '@/services/pptMaker.service';

const mocks = vi.hoisted(() => ({
  createDeckBlob: vi.fn(),
  downloadBlob: vi.fn(),
  savePptxOutput: vi.fn(),
}));

vi.mock('@/services/pptMaker.service', () => ({
  pptMakerService: {
    generateDeckPlan: vi.fn(),
    createGenerationJob: vi.fn(),
  },
}));

vi.mock('@/services/pptDocument.service', () => ({
  enhancePptDocument: vi.fn(async (deckPlan: { title: string }) => ({
    title: deckPlan.title,
    fileName: 'editable-deck.pptx',
    generationMode: 'dom-to-pptx',
    speakerNotes: [],
    qaChecklist: [],
    layouts: [],
    layoutSource: 'html-css',
  })),
}));

vi.mock('@/services/pptExport.service', () => ({
  pptExportService: {
    createDeckBlob: mocks.createDeckBlob,
    downloadBlob: mocks.downloadBlob,
  },
}));

vi.mock('@/services/pptAdmin.service', () => ({
  pptAdminService: {
    savePptxOutput: mocks.savePptxOutput,
  },
}));

describe('PptMakerPage', () => {
  it('downloads and saves an exported PPTX against the registered List project', async () => {
    const deckPlan = createMockDeckPlan({ ...samplePptMakerRequest, slideCount: 6 });
    const pptxBlob = new Blob(['pptx-file']);
    vi.mocked(pptMakerService.generateDeckPlan).mockResolvedValue(deckPlan);
    vi.mocked(pptMakerService.createGenerationJob).mockResolvedValue({
      id: 'saved-presentation-job',
      status: 'succeeded',
      totalItems: 0,
      completedItems: 0,
      items: [],
    });
    mocks.createDeckBlob.mockResolvedValue(pptxBlob);
    mocks.savePptxOutput.mockResolvedValue({
      resultPath: 'ppt-generations/saved-presentation-job/final/editable-deck.pptx',
      pptxUrl: 'https://example.com/editable-deck.pptx',
    });

    const user = userEvent.setup();
    render(
      <Provider store={store}>
        <MemoryRouter>
          <PptMakerPage />
        </MemoryRouter>
      </Provider>,
    );

    await user.type(screen.getByLabelText('Source text'), 'Validated source material for an editable deck.');
    await user.click(screen.getByRole('button', { name: /create ppt deck/i }));
    await screen.findByText('Editable PPTX preview');
    await user.click(screen.getByRole('button', { name: /export & save pptx/i }));

    await waitFor(() => expect(mocks.createDeckBlob).toHaveBeenCalledTimes(1));
    expect(mocks.downloadBlob).toHaveBeenCalledWith(pptxBlob, 'editable-deck.pptx');
    await waitFor(() => expect(mocks.savePptxOutput).toHaveBeenCalledWith('saved-presentation-job', 'editable-deck.pptx', pptxBlob));
  }, 30_000);

  it('generates and displays slide plans from user input', async () => {
    vi.mocked(pptMakerService.generateDeckPlan).mockResolvedValue(
      createMockDeckPlan({ ...samplePptMakerRequest, slideCount: 6 }),
    );
    vi.mocked(pptMakerService.createGenerationJob).mockResolvedValue(null);
    const user = userEvent.setup();
    render(
      <Provider store={store}>
        <MemoryRouter>
          <PptMakerPage />
        </MemoryRouter>
      </Provider>,
    );

    await user.type(
      screen.getByLabelText('Source text'),
      'AI changes execution. Human judgment still matters. Teams need workflows. Validation creates trust.',
    );
    await user.click(screen.getByRole('button', { name: /create ppt deck/i }));
    expect(await screen.findByText('Editable PPTX preview')).toBeInTheDocument();
  }, 30_000);
});
