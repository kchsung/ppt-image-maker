import type { HTMLAttributes, ReactNode } from 'react';
import { cn } from '@/lib/cn';

interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  children: ReactNode;
}

export function Badge({ className, children, ...props }: BadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full bg-primary-muted px-2.5 py-1 text-xs font-semibold text-primary',
        className,
      )}
      {...props}
    >
      {children}
    </span>
  );
}
