import { render, screen } from '@testing-library/react';
import { Provider } from 'react-redux';
import { MemoryRouter } from 'react-router-dom';
import { configureStore } from '@reduxjs/toolkit';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { pptMakerReducer } from '@/features/pptMaker/pptMakerSlice';
import { PptAdminPage } from '@/pages/pptAdmin/PptAdminPage';

const mocks = vi.hoisted(() => ({ listGenerationJobs: vi.fn(), savePptxOutput: vi.fn(), deleteGenerationJob: vi.fn() }));
vi.mock('@/services/pptAdmin.service', () => ({ pptAdminService: mocks }));
vi.mock('@/services/pptDocument.service', () => ({ enhancePptDocument: vi.fn() }));
vi.mock('@/services/pptExport.service', () => ({ pptExportService: { createDeckBlob: vi.fn() } }));

describe('PptAdminPage layout-only projects', () => {
  beforeEach(() => {
    mocks.listGenerationJobs.mockResolvedValue({ jobs: [{ id: 'layout-only-job', title: 'Layout-only project', status: 'succeeded', progress: 100, totalItems: 0, completedItems: 0, createdAt: '2026-07-18T00:00:00.000Z', updatedAt: '2026-07-18T00:00:00.000Z', errorMessage: null, deckPlan: null, resultPath: null, pptxUrl: null, items: [] }] });
  });

  it('does not expose legacy image retry actions', async () => {
    const store = configureStore({ reducer: { pptMaker: pptMakerReducer } });
    render(<Provider store={store}><MemoryRouter><PptAdminPage /></MemoryRouter></Provider>);
    expect(await screen.findByText('No Slide JSON was recorded for this legacy project.')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Retry' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Generate PPTX' })).toBeDisabled();
  });
});
