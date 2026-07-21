'use client';

import { Loader2 } from 'lucide-react';
import { ButtonHTMLAttributes, forwardRef } from 'react';
import { cn } from '@/lib/utils';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger' | 'success';
  size?: 'sm' | 'md' | 'lg';
  isLoading?: boolean;
  loadingText?: string;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  fullWidth?: boolean;
}

// Design bible section 8 — Buttons. Primary/secondary/ghost/danger are the
// canonical variants; `success` is an extra status-colored variant reused
// consistently wherever a confirm/complete action needs it.
const variantStyles = {
  primary: 'bg-primary text-white hover:brightness-95 active:brightness-90',
  secondary: 'bg-white text-ink border border-border hover:bg-surface',
  outline: 'bg-transparent text-primary border border-primary hover:bg-primary hover:text-white',
  ghost: 'bg-transparent text-ink-secondary hover:bg-surface',
  danger: 'bg-danger text-white hover:brightness-95 active:brightness-90',
  success: 'bg-success text-white hover:brightness-95 active:brightness-90',
};

const sizeStyles = {
  sm: 'h-9 px-3 text-sm',
  md: 'h-11 px-4 text-[15px]',
  lg: 'h-11 px-6 text-[15px]',
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      children,
      variant = 'primary',
      size = 'md',
      isLoading = false,
      loadingText,
      leftIcon,
      rightIcon,
      fullWidth = false,
      className,
      disabled,
      ...props
    },
    ref
  ) => {
    const isDisabled = disabled || isLoading;

    return (
      <button
        ref={ref}
        disabled={isDisabled}
        className={cn(
          'inline-flex items-center justify-center gap-2 rounded-lg font-medium',
          'transition-all duration-150 ease-out',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40',
          'disabled:opacity-40 disabled:pointer-events-none',
          'active:scale-[0.98]',
          variantStyles[variant],
          sizeStyles[size],
          fullWidth && 'w-full',
          className
        )}
        {...props}
      >
        {isLoading && <Loader2 className="w-4 h-4 animate-spin" strokeWidth={1.75} />}
        {!isLoading && leftIcon && <span className="flex-shrink-0">{leftIcon}</span>}
        <span>{isLoading && loadingText ? loadingText : children}</span>
        {!isLoading && rightIcon && <span className="flex-shrink-0">{rightIcon}</span>}
      </button>
    );
  }
);

Button.displayName = 'Button';

export function IconButton({
  icon,
  label,
  ...props
}: Omit<ButtonProps, 'leftIcon' | 'rightIcon'> & {
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <button
      aria-label={label}
      title={label}
      className={cn(
        'inline-flex items-center justify-center rounded-lg',
        'transition-all duration-150 ease-out',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40',
        'disabled:opacity-40 disabled:pointer-events-none',
        'active:scale-95',
        'p-2 text-ink-secondary hover:bg-surface',
        props.className
      )}
      {...props}
    >
      {icon}
    </button>
  );
}

export function ButtonGroup({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={cn('inline-flex rounded-lg border border-border overflow-hidden', className)} role="group">
      {children}
    </div>
  );
}
