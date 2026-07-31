import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Provider } from 'react-redux';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import { store } from '@/app/store';
import { createMockDeckPlan, samplePptMakerRequest } from '@/mocks/pptMaker.mock';
import { PptMakerPage } from '@/pages/pptMaker/PptMakerPage';
import { pptMakerService } from '@/services/pptMaker.service';

vi.mock('@/services/pptMaker.service', () => ({
  pptMakerService: {
    generateDeckPlan: vi.fn(),
    createGenerationJob: vi.fn(),
  },
}));

describe('PptMakerPage', () => {
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
  });
});
