import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Provider } from 'react-redux';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import { store } from '@/app/store';
import { PptMakerPage } from '@/pages/pptMaker/PptMakerPage';

describe('PptMakerPage', () => {
  it('generates and displays slide plans from user input', async () => {
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
    await user.click(screen.getByRole('button', { name: /generate ppt images/i }));
    expect(await screen.findByAltText('PPT preview slide 1')).toBeInTheDocument();
  });
});
