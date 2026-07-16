import type { TextareaHTMLAttributes } from 'react';
import { cn } from '@/lib/cn';

export function Textarea({ className, ...props }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      className={cn(
        'min-h-32 w-full resize-y rounded-md border border-border bg-surface px-3 py-2 text-sm text-text-main outline-none transition placeholder:text-text-subtle focus:border-primary',
        className,
      )}
      {...props}
    />
  );
}
