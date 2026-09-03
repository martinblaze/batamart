'use client';

import { create } from 'zustand';
import { CheckCircle2, XCircle, AlertCircle, Info, X } from 'lucide-react';

export type ToastType = 'success' | 'error' | 'warning' | 'info';

interface Toast {
  id: string;
  type: ToastType;
  title?: string;
  message: string;
  duration?: number;
}

interface ToastStore {
  toasts: Toast[];
  addToast: (toast: Omit<Toast, 'id'>) => void;
  removeToast: (id: string) => void;
}

export const useToastStore = create<ToastStore>((set) => ({
  toasts: [],
  addToast: (toast) => {
    const id = `toast_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    set((state) => ({
      toasts: [...state.toasts, { ...toast, id }],
    }));

    // Auto remove after duration
    const duration = toast.duration || 5000;
    setTimeout(() => {
      set((state) => ({
        toasts: state.toasts.filter((t) => t.id !== id),
      }));
    }, duration);
  },
  removeToast: (id) =>
    set((state) => ({
      toasts: state.toasts.filter((t) => t.id !== id),
    })),
}));

export function useToast() {
  const { addToast } = useToastStore();

  return {
    success: (message: string, title?: string, duration?: number) =>
      addToast({ type: 'success', message, title, duration }),
    error: (message: string, title?: string, duration?: number) =>
      addToast({ type: 'error', message, title, duration }),
    warning: (message: string, title?: string, duration?: number) =>
      addToast({ type: 'warning', message, title, duration }),
    info: (message: string, title?: string, duration?: number) =>
      addToast({ type: 'info', message, title, duration }),
  };
}

export function ToastContainer() {
  const { toasts, removeToast } = useToastStore();

  const getIcon = (type: ToastType) => {
    switch (type) {
      case 'success':
        return <CheckCircle2 className="w-5 h-5 text-success" strokeWidth={1.75} />;
      case 'error':
        return <XCircle className="w-5 h-5 text-danger" strokeWidth={1.75} />;
      case 'warning':
        return <AlertCircle className="w-5 h-5 text-warning" strokeWidth={1.75} />;
      case 'info':
        return <Info className="w-5 h-5 text-primary" strokeWidth={1.75} />;
    }
  };

  const getStyles = (type: ToastType) => {
    switch (type) {
      case 'success':
        return 'bg-card border-success/30';
      case 'error':
        return 'bg-card border-danger/30';
      case 'warning':
        return 'bg-card border-warning/30';
      case 'info':
        return 'bg-card border-primary/30';
    }
  };

  return (
    <div className="fixed top-4 right-4 z-[100] flex flex-col gap-2 max-w-sm w-full pointer-events-none">
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className={`${getStyles(
            toast.type
          )} border rounded-lg shadow-soft p-4 pointer-events-auto animate-in slide-in-from-right-5 duration-200`}
        >
          <div className="flex items-start gap-3">
            <div className="flex-shrink-0 mt-0.5">{getIcon(toast.type)}</div>
            <div className="flex-1 min-w-0">
              {toast.title && (
                <h4 className="text-sm font-semibold text-ink mb-1">
                  {toast.title}
                </h4>
              )}
              <p className="text-sm text-ink-secondary">{toast.message}</p>
            </div>
            <button
              onClick={() => removeToast(toast.id)}
              className="flex-shrink-0 text-ink-muted hover:text-ink-secondary transition-colors"
              aria-label="Dismiss notification"
            >
              <X className="w-4 h-4" strokeWidth={1.75} />
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}