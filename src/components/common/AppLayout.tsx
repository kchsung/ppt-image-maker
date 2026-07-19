import { useState, type ReactNode } from 'react';
import { NavLink } from 'react-router-dom';
import { FileImage, LayoutDashboard, Menu, ShieldCheck, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/cn';

interface AppLayoutProps {
  children: ReactNode;
}

export function AppLayout({ children }: AppLayoutProps) {
  const [isMobileNavigationOpen, setIsMobileNavigationOpen] = useState(false);

  return (
    <div className="min-h-screen bg-background text-text-main">
      <aside className="fixed inset-y-0 left-0 hidden w-64 border-r border-border bg-surface px-4 py-5 md:block">
        <Navigation />
      </aside>

      <header className="sticky top-0 z-40 flex h-14 items-center justify-between border-b border-border bg-surface px-4 md:hidden">
        <NavLink to="/ppt-maker" className="flex items-center gap-2 text-base font-bold text-primary">
          <LayoutDashboard className="h-5 w-5" />
          QLEARN
        </NavLink>
        <Button
          type="button"
          variant="ghost"
          className="w-10 px-0"
          aria-label="Open navigation"
          onClick={() => setIsMobileNavigationOpen(true)}
        >
          <Menu className="h-5 w-5" />
        </Button>
      </header>

      {isMobileNavigationOpen ? (
        <div className="fixed inset-0 z-50 md:hidden">
          <button
            type="button"
            className="absolute inset-0 bg-black/40"
            aria-label="Close navigation"
            onClick={() => setIsMobileNavigationOpen(false)}
          />
          <aside className="relative h-full w-72 border-r border-border bg-surface px-4 py-5 shadow-xl">
            <div className="mb-8 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2 text-lg font-bold text-primary">
                <LayoutDashboard className="h-5 w-5" />
                QLEARN
              </div>
              <Button
                type="button"
                variant="ghost"
                className="w-10 px-0"
                aria-label="Close navigation"
                onClick={() => setIsMobileNavigationOpen(false)}
              >
                <X className="h-5 w-5" />
              </Button>
            </div>
            <Navigation showBrand={false} onNavigate={() => setIsMobileNavigationOpen(false)} />
          </aside>
        </div>
      ) : null}

      <main className="md:pl-64">
        <div className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 lg:px-8">{children}</div>
      </main>
    </div>
  );
}

function Navigation({ onNavigate, showBrand = true }: { onNavigate?: () => void; showBrand?: boolean }) {
  return (
    <>
      {showBrand ? (
        <div className="mb-8 flex items-center gap-2 text-lg font-bold text-primary">
          <LayoutDashboard className="h-5 w-5" />
          QLEARN
        </div>
      ) : null}
      <nav className="space-y-1" aria-label="Primary navigation">
        <NavLink
          to="/ppt-maker"
          onClick={onNavigate}
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
        <NavLink
          to="/ppt-admin"
          onClick={onNavigate}
          className={({ isActive }) =>
            cn(
              'flex items-center gap-2 rounded-md px-3 py-2 text-sm font-semibold text-text-subtle',
              isActive && 'bg-primary-muted text-primary',
            )
          }
        >
          <ShieldCheck className="h-4 w-4" />
          List
        </NavLink>
      </nav>
    </>
  );
}
