'use client';

import { useEffect, useState, ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: ReactNode;
  /** Renders as a bottom sheet on mobile, centered dialog on desktop (default). Pass 'dialog' to force the centered dialog at every size. */
  variant?: 'sheet' | 'dialog';
  className?: string;
}

// Design bible section 8 — Modals/drawers. 16px radius (top corners only for
// mobile bottom sheets), 200-250ms entry motion, one canonical implementation.
export function Modal({ open, onClose, title, children, variant = 'sheet', className }: ModalProps) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [open, onClose]);

  if (!mounted || !open) return null;

  const isSheet = variant === 'sheet';

  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center">
      <div
        className="absolute inset-0 bg-ink/40 animate-in fade-in duration-200"
        onClick={onClose}
        aria-hidden="true"
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={cn(
          'relative bg-card w-full sm:max-w-md max-h-[90vh] overflow-y-auto',
          'animate-in duration-200',
          isSheet
            ? 'rounded-t-2xl sm:rounded-2xl slide-in-from-bottom sm:zoom-in-95'
            : 'rounded-2xl zoom-in-95 mx-4',
          className
        )}
      >
        {title && (
          <div className="flex items-center justify-between px-4 py-4 border-b border-border sticky top-0 bg-card">
            <h2 className="text-[16px] font-medium text-ink">{title}</h2>
            <button
              onClick={onClose}
              aria-label="Close"
              className="p-2 -mr-2 rounded-lg text-ink-secondary hover:bg-surface transition-colors"
            >
              <X className="w-5 h-5" strokeWidth={1.75} />
            </button>
          </div>
        )}
        <div className="p-4">{children}</div>
      </div>
    </div>,
    document.body
  );
}
