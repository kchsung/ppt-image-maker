import { render, screen } from '@testing-library/react';
import { Provider } from 'react-redux';
import { MemoryRouter } from 'react-router-dom';
import { configureStore } from '@reduxjs/toolkit';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { pptMakerReducer } from '@/features/pptMaker/pptMakerSlice';
import { samplePptMakerRequest } from '@/mocks/pptMaker.mock';
import { PptAdminPage } from '@/pages/pptAdmin/PptAdminPage';

const mocks = vi.hoisted(() => ({ listGenerationJobs: vi.fn(), savePptxOutput: vi.fn(), deleteGenerationJob: vi.fn() }));
vi.mock('@/services/pptAdmin.service', () => ({ pptAdminService: mocks }));
vi.mock('@/services/pptDocument.service', () => ({ enhancePptDocument: vi.fn() }));
vi.mock('@/services/pptExport.service', () => ({ pptExportService: { createDeckBlob: vi.fn() } }));

describe('PptAdminPage legacy project visibility', () => {
  beforeEach(() => {
    mocks.listGenerationJobs.mockResolvedValue({ jobs: [{ id: 'legacy-job', title: 'Legacy project', status: 'succeeded', progress: 100, totalItems: 1, completedItems: 1, createdAt: '2026-07-18T00:00:00.000Z', updatedAt: '2026-07-18T00:00:00.000Z', errorMessage: null, deckPlan: { id: 'legacy-plan', title: 'Legacy project', createdAt: '2026-07-18T00:00:00.000Z', request: samplePptMakerRequest, slides: [], copyQa: { status: 'needs-review', checks: [], issues: ['Legacy copy plan'] } }, resultPath: null, pptxUrl: null, items: [] }] });
  });

  it('keeps old projects readable without reintroducing image generation controls', async () => {
    const store = configureStore({ reducer: { pptMaker: pptMakerReducer } });
    render(<Provider store={store}><MemoryRouter><PptAdminPage /></MemoryRouter></Provider>);
    expect(await screen.findByText('Legacy project')).toBeInTheDocument();
    expect(screen.getByText('No Slide JSON was recorded for this legacy project.')).toBeInTheDocument();
    expect(screen.queryByText('Legacy Copy')).not.toBeInTheDocument();
  });
});
