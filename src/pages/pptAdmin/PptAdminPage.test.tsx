import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Provider } from 'react-redux';
import { MemoryRouter } from 'react-router-dom';
import { store } from '@/app/store';
import { PptAdminPage } from '@/pages/pptAdmin/PptAdminPage';

describe('PptAdminPage', () => {
  it('loads and displays generation jobs', async () => {
    render(
      <Provider store={store}>
        <MemoryRouter>
          <PptAdminPage />
        </MemoryRouter>
      </Provider>,
    );

    expect(screen.getByRole('heading', { name: 'PPT List' })).toBeInTheDocument();
    expect(await screen.findByText('AI-Ready Judgment And Execution')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /refresh/i })).toBeInTheDocument();
  });
});
