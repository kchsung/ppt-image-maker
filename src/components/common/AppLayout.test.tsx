import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { AppLayout } from '@/components/common/AppLayout';

describe('AppLayout mobile navigation', () => {
  it('opens the navigation panel and closes it after a destination is selected', async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter initialEntries={['/ppt-maker']}>
        <AppLayout><div>Page content</div></AppLayout>
      </MemoryRouter>,
    );

    await user.click(screen.getByRole('button', { name: 'Open navigation' }));
    expect(screen.getAllByRole('button', { name: 'Close navigation' })).toHaveLength(2);

    const listLinks = screen.getAllByRole('link', { name: 'List' });
    await user.click(listLinks.at(-1)!);

    expect(screen.queryByRole('button', { name: 'Close navigation' })).not.toBeInTheDocument();
  });
});
