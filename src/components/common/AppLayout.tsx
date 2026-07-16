import type { ReactNode } from 'react';
import { NavLink } from 'react-router-dom';
import { FileImage, LayoutDashboard } from 'lucide-react';
import { cn } from '@/lib/cn';

interface AppLayoutProps {
  children: ReactNode;
}

export function AppLayout({ children }: AppLayoutProps) {
  return (
    <div className="min-h-screen bg-background text-text-main">
      <aside className="fixed inset-y-0 left-0 hidden w-64 border-r border-border bg-surface px-4 py-5 md:block">
        <div className="mb-8 flex items-center gap-2 text-lg font-bold text-primary">
          <LayoutDashboard className="h-5 w-5" />
          QLEARN
        </div>
        <nav className="space-y-1">
          <NavLink
            to="/ppt-maker"
            className={({ isActive }) =>
              cn(
                'flex items-center gap-2 rounded-md px-3 py-2 text-sm font-semibold text-text-subtle',
                isActive && 'bg-primary-muted text-primary',
              )
            }
          >
            <FileImage className="h-4 w-4" />
            PPT Maker
          </NavLink>
        </nav>
      </aside>
      <main className="md:pl-64">
        <div className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 lg:px-8">{children}</div>
      </main>
    </div>
  );
}
