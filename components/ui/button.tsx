'use client';

import { Loader2 } from 'lucide-react';
import { motion, useMotionValue, useSpring, useTransform } from 'framer-motion';
import { ButtonHTMLAttributes, forwardRef, useRef, useState } from 'react';
import { cn } from '@/lib/utils';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger' | 'success' | 'ink';
  size?: 'sm' | 'md' | 'lg';
  isLoading?: boolean;
  loadingText?: string;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  fullWidth?: boolean;
}

/* Working-UI buttons stay cheap: colour and border transitions only, on a
   long ease so hover reads as a settle rather than a flick. The expensive
   gesture — the magnetic follow — is opt-in via <MagnetButton> below, for the
   single primary action on a screen. Pages here render hundreds of controls,
   so the default must not carry per-pointer-move work. */
const variantStyles = {
  primary: 'bg-primary text-white hover:brightness-[1.06] active:brightness-95',
  ink: 'bg-ink text-background hover:bg-ink/90',
  secondary: 'bg-card text-ink border border-border hover:border-ink/25 hover:bg-surface',
  outline: 'bg-transparent text-primary border border-primary/60 hover:bg-primary hover:text-white hover:border-primary',
  ghost: 'bg-transparent text-ink-secondary hover:bg-surface hover:text-ink',
  danger: 'bg-danger text-white hover:brightness-[1.06] active:brightness-95',
  success: 'bg-success text-white hover:brightness-[1.06] active:brightness-95',
};

const sizeStyles = {
  sm: 'h-9 px-3.5 text-[13px]',
  md: 'h-11 px-5 text-sm',
  lg: 'h-12 px-7 text-[15px]',
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
          'group relative inline-flex items-center justify-center gap-2 rounded-lg',
          'font-medium tracking-[-0.005em]',
          // CSS-only hover wipe — see `.ui-btn-sweep` in styles/app-ui.css.
          // The expensive magnetic gesture is opt-in via <RubberButton>.
          'ui-btn-sweep',
          'transition-[background-color,color,border-color,filter,transform] duration-300 ease-out',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/45 focus-visible:ring-offset-2 focus-visible:ring-offset-background',
          'disabled:opacity-40 disabled:pointer-events-none',
          'active:scale-[0.985]',
          variantStyles[variant],
          sizeStyles[size],
          fullWidth && 'w-full',
          className
        )}
        {...props}
      >
        {isLoading && <Loader2 className="w-4 h-4 animate-spin" strokeWidth={2} />}
        {!isLoading && leftIcon && <span className="flex-shrink-0">{leftIcon}</span>}
        <span>{isLoading && loadingText ? loadingText : children}</span>
        {!isLoading && rightIcon && (
          <span className="flex-shrink-0 transition-transform duration-300 ease-out group-hover:translate-x-0.5">
            {rightIcon}
          </span>
        )}
      </button>
    );
  }
);

Button.displayName = 'Button';

/**
 * The rubber button — the same gesture the marketing surface uses, on the
 * product's tokens.
 *
 * Reserved for the one primary action on a screen (add to cart, place order,
 * publish listing). Three things overlap, and the overlap is what sells it:
 *
 *  1. The shell chases the cursor on an under-damped spring, so it arrives
 *     with a little overshoot instead of tracking rigidly.
 *  2. The label chases harder than the shell, so the face appears to lag
 *     inside its own frame — the parallax that reads as depth.
 *  3. The shell stretches along the axis it is pulled and pinches across it,
 *     which is what a rubber sheet does under tension.
 *
 * The padded wrapper is the magnetic field: the button starts reacting just
 * before the cursor technically reaches it. Negative margin keeps that field
 * out of the layout, so it never disturbs surrounding spacing.
 *
 * Everything else on a screen uses <Button>, which stays cheap — these pages
 * render hundreds of controls and none of them should carry per-pointer-move
 * work.
 */
export const RubberButton = forwardRef<
  HTMLButtonElement,
  Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'children'> & {
    children: React.ReactNode;
    variant?: 'ink' | 'ghost' | 'danger';
    size?: 'sm' | 'md' | 'lg';
    isLoading?: boolean;
    loadingText?: string;
    leftIcon?: React.ReactNode;
    fullWidth?: boolean;
    /** How far the button may chase the cursor, in px. */
    pull?: number;
  }
>(
  (
    {
      children,
      variant = 'ink',
      size = 'md',
      isLoading = false,
      loadingText,
      leftIcon,
      fullWidth = false,
      pull = 18,
      className,
      disabled,
      ...props
    },
    forwardedRef
  ) => {
    const shellRef = useRef<HTMLDivElement>(null);
    const [hot, setHot] = useState(false);
    const [origin, setOrigin] = useState({ left: '50%', top: '50%' });
    const isDisabled = disabled || isLoading;

    const x = useMotionValue(0);
    const y = useMotionValue(0);

    // Low damping + low mass is the elastic settle. This is the whole feel.
    const spring = { stiffness: 260, damping: 15, mass: 0.4 };
    const sx = useSpring(x, spring);
    const sy = useSpring(y, spring);

    const labelX = useTransform(sx, (v) => v * 0.55);
    const labelY = useTransform(sy, (v) => v * 0.55);

    const scaleX = useTransform<number, number>(
      [sx, sy],
      ([dx, dy]) => 1 + Math.abs(dx) / 460 - Math.abs(dy) / 1300
    );
    const scaleY = useTransform<number, number>(
      [sx, sy],
      ([dx, dy]) => 1 + Math.abs(dy) / 460 - Math.abs(dx) / 1300
    );

    const setFillOrigin = (e: React.PointerEvent) => {
      const rect = shellRef.current?.getBoundingClientRect();
      if (!rect) return;
      setOrigin({
        left: `${e.clientX - rect.left}px`,
        top: `${e.clientY - rect.top}px`,
      });
    };

    const sizes = {
      sm: 'h-9 px-4',
      md: 'h-11 px-6',
      lg: 'h-12 px-8',
    };

    return (
      <div
        ref={shellRef}
        className={cn('inline-flex p-[14px] m-[-14px]', fullWidth && 'w-[calc(100%+28px)]')}
        onPointerMove={(e) => {
          const rect = shellRef.current?.getBoundingClientRect();
          if (!rect || isDisabled) return;
          x.set(((e.clientX - (rect.left + rect.width / 2)) / (rect.width / 2)) * pull);
          y.set(((e.clientY - (rect.top + rect.height / 2)) / (rect.height / 2)) * pull);
        }}
        onPointerEnter={(e) => {
          if (isDisabled) return;
          setFillOrigin(e);
          setHot(true);
        }}
        onPointerLeave={(e) => {
          if (isDisabled) return;
          setFillOrigin(e);
          setHot(false);
          x.set(0);
          y.set(0);
        }}
      >
        <motion.div
          style={{ x: sx, y: sy, scaleX, scaleY }}
          className={cn('inline-flex', fullWidth && 'w-full')}
        >
          <button
            ref={forwardedRef}
            disabled={isDisabled}
            data-hot={hot}
            className={cn(
              'ui-btn',
              `ui-btn--${variant}`,
              sizes[size],
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/45 focus-visible:ring-offset-2 focus-visible:ring-offset-background',
              fullWidth && 'w-full',
              className
            )}
            {...props}
          >
            <motion.span
              className="ui-btn__fill"
              style={{ ...origin, x: '-50%', y: '-50%' }}
              animate={{ scale: hot ? 1 : 0 }}
              transition={{ duration: hot ? 0.62 : 0.42, ease: [0.16, 1, 0.3, 1] }}
            />
            <motion.span className="ui-btn__label" style={{ x: labelX, y: labelY }}>
              {isLoading && <Loader2 className="w-3.5 h-3.5 animate-spin" strokeWidth={2} />}
              {!isLoading && leftIcon}
              {isLoading && loadingText ? loadingText : children}
            </motion.span>
          </button>
        </motion.div>
      </div>
    );
  }
);

RubberButton.displayName = 'RubberButton';

/** @deprecated Use <RubberButton>. Kept so existing call sites keep working. */
export const MagnetButton = RubberButton;

/**
 * The magnetic follow with no chrome of its own.
 *
 * Wrap it around a CTA that already has its own styling (the checkout, buy
 * and publish buttons each carry page-specific CSS) to give it the same
 * cursor-chasing spring and rubber stretch without restyling it. The padded
 * wrapper is the magnetic field; the negative margin keeps that field out of
 * the layout so surrounding spacing is untouched.
 *
 * `block` is for full-width buttons, where an inline-flex wrapper would
 * collapse the child to its content width.
 */
export function Magnetic({
  children,
  pull = 14,
  block = false,
  className,
}: {
  children: React.ReactNode;
  pull?: number;
  block?: boolean;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const spring = { stiffness: 280, damping: 16, mass: 0.35 };
  const sx = useSpring(x, spring);
  const sy = useSpring(y, spring);

  const scaleX = useTransform<number, number>(
    [sx, sy],
    ([dx, dy]) => 1 + Math.abs(dx) / 520 - Math.abs(dy) / 1500
  );
  const scaleY = useTransform<number, number>(
    [sx, sy],
    ([dx, dy]) => 1 + Math.abs(dy) / 520 - Math.abs(dx) / 1500
  );

  return (
    <div
      ref={ref}
      className={cn(
        block ? 'block w-[calc(100%+24px)] p-[12px] m-[-12px]' : 'inline-flex p-[12px] m-[-12px]',
        className
      )}
      onPointerMove={(e) => {
        const rect = ref.current?.getBoundingClientRect();
        if (!rect) return;
        x.set(((e.clientX - (rect.left + rect.width / 2)) / (rect.width / 2)) * pull);
        y.set(((e.clientY - (rect.top + rect.height / 2)) / (rect.height / 2)) * pull);
      }}
      onPointerLeave={() => {
        x.set(0);
        y.set(0);
      }}
    >
      <motion.div
        style={{ x: sx, y: sy, scaleX, scaleY }}
        className={block ? 'w-full' : 'inline-flex'}
      >
        {children}
      </motion.div>
    </div>
  );
}

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
        'transition-colors duration-200 ease-out',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/45',
        'disabled:opacity-40 disabled:pointer-events-none',
        'active:scale-95',
        'p-2 text-ink-secondary hover:bg-surface hover:text-ink',
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
