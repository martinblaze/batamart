'use client';

import { InputHTMLAttributes, SelectHTMLAttributes, TextareaHTMLAttributes, forwardRef, useId } from 'react';
import { ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';

/* Fields read as one continuous surface: a white ground, a hairline, and an
   accent border that arrives on focus. The label is mono and set above the
   field so a form scans as a list of named values rather than a stack of
   boxes — the thing that separates a considered checkout from a generic one. */
const fieldBase = cn(
  'w-full bg-card text-ink text-[15px] tracking-[-0.005em] rounded-lg',
  'border border-border',
  'placeholder:text-ink-muted/80',
  'focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/15',
  'disabled:opacity-40 disabled:pointer-events-none',
  'transition-[border-color,box-shadow] duration-200 ease-out'
);

const labelBase =
  'block font-mono text-[10px] uppercase tracking-[0.16em] font-medium text-ink-secondary';

function FieldNote({ error, helperText }: { error?: string; helperText?: string }) {
  if (error) return <p className="text-xs text-danger">{error}</p>;
  if (helperText) return <p className="text-xs text-ink-muted">{helperText}</p>;
  return null;
}

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  helperText?: string;
  containerClassName?: string;
  leftIcon?: React.ReactNode;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, helperText, className, containerClassName, id, leftIcon, ...props }, ref) => {
    const generatedId = useId();
    const inputId = id || generatedId;

    return (
      <div className={cn('flex flex-col gap-2', containerClassName)}>
        {label && (
          <label htmlFor={inputId} className={labelBase}>
            {label}
          </label>
        )}
        <div className="relative">
          {leftIcon && (
            <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-ink-muted">
              {leftIcon}
            </span>
          )}
          <input
            ref={ref}
            id={inputId}
            aria-invalid={!!error}
            className={cn(
              fieldBase,
              'h-12 px-4',
              leftIcon && 'pl-11',
              error && 'border-danger focus:border-danger focus:ring-danger/15',
              className
            )}
            {...props}
          />
        </div>
        <FieldNote error={error} helperText={helperText} />
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
      <div className={cn('flex flex-col gap-2', containerClassName)}>
        {label && (
          <label htmlFor={inputId} className={labelBase}>
            {label}
          </label>
        )}
        <textarea
          ref={ref}
          id={inputId}
          aria-invalid={!!error}
          className={cn(
            fieldBase,
            'px-4 py-3.5 leading-relaxed resize-none',
            error && 'border-danger focus:border-danger focus:ring-danger/15',
            className
          )}
          {...props}
        />
        <FieldNote error={error} helperText={helperText} />
      </div>
    );
  }
);

Textarea.displayName = 'Textarea';

interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  error?: string;
  helperText?: string;
  containerClassName?: string;
}

/** Native select with the platform arrow replaced, so it matches Input. */
export const Select = forwardRef<HTMLSelectElement, SelectProps>(
  ({ label, error, helperText, className, containerClassName, id, children, ...props }, ref) => {
    const generatedId = useId();
    const inputId = id || generatedId;

    return (
      <div className={cn('flex flex-col gap-2', containerClassName)}>
        {label && (
          <label htmlFor={inputId} className={labelBase}>
            {label}
          </label>
        )}
        <div className="relative">
          <select
            ref={ref}
            id={inputId}
            aria-invalid={!!error}
            className={cn(
              fieldBase,
              'h-12 pl-4 pr-11 appearance-none cursor-pointer',
              error && 'border-danger focus:border-danger focus:ring-danger/15',
              className
            )}
            {...props}
          >
            {children}
          </select>
          <ChevronDown
            className="pointer-events-none absolute right-4 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-muted"
            strokeWidth={1.75}
            aria-hidden
          />
        </div>
        <FieldNote error={error} helperText={helperText} />
      </div>
    );
  }
);

Select.displayName = 'Select';
