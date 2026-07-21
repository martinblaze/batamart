'use client';

import { InputHTMLAttributes, TextareaHTMLAttributes, forwardRef, useId } from 'react';
import { cn } from '@/lib/utils';

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  helperText?: string;
  containerClassName?: string;
}

// Design bible section 8 — Inputs. Label above field, 44px height, 8px
// radius, error/helper text below. One implementation reused everywhere.
export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, helperText, className, containerClassName, id, ...props }, ref) => {
    const generatedId = useId();
    const inputId = id || generatedId;

    return (
      <div className={cn('flex flex-col gap-1.5', containerClassName)}>
        {label && (
          <label htmlFor={inputId} className="text-[13px] text-ink-secondary">
            {label}
          </label>
        )}
        <input
          ref={ref}
          id={inputId}
          aria-invalid={!!error}
          className={cn(
            'h-11 px-4 rounded-lg border bg-surface text-ink text-[15px]',
            'placeholder:text-ink-muted',
            'focus:outline-none focus:ring-2 focus:ring-primary/15',
            'disabled:opacity-40 disabled:pointer-events-none',
            'transition-colors duration-150',
            error ? 'border-danger focus:border-danger' : 'border-border focus:border-primary',
            className
          )}
          {...props}
        />
        {error ? (
          <p className="text-xs text-danger">{error}</p>
        ) : helperText ? (
          <p className="text-xs text-ink-muted">{helperText}</p>
        ) : null}
      </div>
    );
  }
);

Input.displayName = 'Input';

interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  error?: string;
  helperText?: string;
  containerClassName?: string;
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ label, error, helperText, className, containerClassName, id, ...props }, ref) => {
    const generatedId = useId();
    const inputId = id || generatedId;

    return (
      <div className={cn('flex flex-col gap-1.5', containerClassName)}>
        {label && (
          <label htmlFor={inputId} className="text-[13px] text-ink-secondary">
            {label}
          </label>
        )}
        <textarea
          ref={ref}
          id={inputId}
          aria-invalid={!!error}
          className={cn(
            'px-4 py-3 rounded-lg border bg-surface text-ink text-[15px]',
            'placeholder:text-ink-muted',
            'focus:outline-none focus:ring-2 focus:ring-primary/15',
            'disabled:opacity-40 disabled:pointer-events-none',
            'transition-colors duration-150',
            error ? 'border-danger focus:border-danger' : 'border-border focus:border-primary',
            className
          )}
          {...props}
        />
        {error ? (
          <p className="text-xs text-danger">{error}</p>
        ) : helperText ? (
          <p className="text-xs text-ink-muted">{helperText}</p>
        ) : null}
      </div>
    );
  }
);

Textarea.displayName = 'Textarea';
