import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { PptAdminPage } from '@/pages/pptAdmin/PptAdminPage';

describe('PptAdminPage', () => {
  it('loads and displays generation jobs', async () => {
    render(<PptAdminPage />);

    expect(screen.getByRole('heading', { name: 'PPT Generation Admin' })).toBeInTheDocument();
    expect(await screen.findByText('AI Lecture Deck')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /refresh/i })).toBeInTheDocument();
  });
});
