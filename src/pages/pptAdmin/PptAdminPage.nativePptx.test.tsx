import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Provider } from 'react-redux';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { configureStore } from '@reduxjs/toolkit';
import { pptMakerReducer } from '@/features/pptMaker/pptMakerSlice';
import { samplePptMakerRequest } from '@/mocks/pptMaker.mock';
import { PptAdminPage } from '@/pages/pptAdmin/PptAdminPage';
import type { PptDeckPlan } from '@/types/models/pptMaker.model';

const mocks = vi.hoisted(() => ({ listGenerationJobs: vi.fn(), savePptxOutput: vi.fn(), deleteGenerationJob: vi.fn(), enhancePptDocument: vi.fn(), createDeckBlob: vi.fn() }));
vi.mock('@/services/pptAdmin.service', () => ({ pptAdminService: mocks }));
vi.mock('@/services/pptDocument.service', () => ({ enhancePptDocument: mocks.enhancePptDocument }));
vi.mock('@/services/pptExport.service', () => ({ pptExportService: { createDeckBlob: mocks.createDeckBlob } }));

const deckPlan: PptDeckPlan = { id: 'native-deck', title: 'Native PPTX deck', createdAt: '2026-07-18T00:00:00.000Z', request: samplePptMakerRequest, slides: [{ id: 'slide-1', pageNumber: 1, archetype: 'cover', visualStructure: 'hero-visual', mainMessage: 'A clear message.', title: 'Native title', subtitle: 'Native subtitle', objective: 'Set the decision this presentation must support.', labels: ['Context', 'Evidence', 'Action'], contentBlocks: [{ heading: 'Context', detail: 'Clarify the business situation that makes this decision necessary.' }, { heading: 'Evidence', detail: 'Summarize the proof points used to guide the discussion.' }, { heading: 'Action', detail: 'Name the accountable next step after the presentation.' }], decision: 'Approve the next action and its owner.', takeaway: 'Native takeaway', imageSlot: { id: 'visual-1', purpose: 'Supporting structure.', placement: 'right-hero', prompt: 'Legacy prompt' }, imagePrompt: 'Legacy prompt' }], copyQa: { status: 'passed', checks: ['Copy passed.'], issues: [] } };

describe('PptAdminPage editable output', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.listGenerationJobs.mockResolvedValue({ jobs: [{ id: 'native-job', title: deckPlan.title, status: 'succeeded', progress: 100, totalItems: 0, completedItems: 0, createdAt: '2026-07-18T00:00:00.000Z', updatedAt: '2026-07-18T00:00:00.000Z', errorMessage: null, deckPlan, resultPath: null, pptxUrl: null, pptxStatus: 'not-started', items: [] }] });
    mocks.enhancePptDocument.mockResolvedValue({ title: deckPlan.title, fileName: 'native-deck.pptx', generationMode: 'dom-to-pptx', speakerNotes: [], qaChecklist: [], layouts: [], layoutSource: 'html-css' });
    mocks.createDeckBlob.mockResolvedValue(new Blob(['pptx']));
    mocks.savePptxOutput.mockResolvedValue({ resultPath: 'ppt-generations/native-job/final/native-deck.pptx', pptxUrl: 'https://example.com/native-deck.pptx' });
  });

  it('converts the saved HTML/CSS Slide JSON deck and saves it to Supabase Storage', async () => {
    const store = configureStore({ reducer: { pptMaker: pptMakerReducer } });
    const user = userEvent.setup();
    render(<Provider store={store}><MemoryRouter><PptAdminPage /></MemoryRouter></Provider>);
    await user.click(await screen.findByRole('button', { name: 'Generate PPTX' }));
    await waitFor(() => expect(mocks.enhancePptDocument).toHaveBeenCalledWith(deckPlan));
    await waitFor(() => expect(mocks.createDeckBlob).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(mocks.savePptxOutput).toHaveBeenCalledWith('native-job', 'native-deck.pptx', expect.any(Blob)));
  });
});
