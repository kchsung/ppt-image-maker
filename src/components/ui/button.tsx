import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { cn } from '@/lib/cn';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost';
  children: ReactNode;
}

const variantClass = {
  primary: 'bg-primary text-white hover:opacity-95',
  secondary: 'border border-border bg-surface text-text-main hover:bg-surface-muted',
  ghost: 'text-text-subtle hover:bg-surface-muted',
};

export function Button({ className, variant = 'primary', children, ...props }: ButtonProps) {
  return (
    <button
      className={cn(
        'inline-flex h-10 items-center justify-center gap-2 rounded-md px-4 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-50',
        variantClass[variant],
        className,
      )}
      {...props}
    >
      {children}
    </button>
  );
}
