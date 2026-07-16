import type { ReactNode } from 'react';

interface PageHeaderProps {
  eyebrow: string;
  title: string;
  description: string;
  actions?: ReactNode;
}

export function PageHeader({ eyebrow, title, description, actions }: PageHeaderProps) {
  return (
    <header className="mb-6 flex flex-col gap-4 border-b border-border pb-5 lg:flex-row lg:items-end lg:justify-between">
      <div>
        <p className="mb-2 text-xs font-bold uppercase tracking-wide text-accent">{eyebrow}</p>
        <h1 className="text-2xl font-bold text-primary">{title}</h1>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-text-subtle">{description}</p>
      </div>
      {actions ? <div className="flex items-center gap-2">{actions}</div> : null}
    </header>
  );
}
