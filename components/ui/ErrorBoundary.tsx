'use client';

import { Component, ReactNode } from 'react';
import { AlertTriangle, RefreshCw, Home } from 'lucide-react';
import Link from 'next/link';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error?: Error;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: any) {
    console.error('Error boundary caught:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div className="min-h-screen bg-surface flex items-center justify-center p-4">
          <div className="max-w-md w-full bg-white border border-border rounded-2xl shadow-soft p-8 text-center">
            <div className="w-16 h-16 bg-danger/10 rounded-full flex items-center justify-center mx-auto mb-4">
              <AlertTriangle className="w-8 h-8 text-danger" strokeWidth={1.75} />
            </div>
            <h1 className="text-[20px] font-semibold text-ink mb-2">
              Something went wrong
            </h1>
            <p className="text-[15px] text-ink-secondary mb-6">
              We encountered an error while loading this page. Don&apos;t worry, it&apos;s not your fault!
            </p>
            {this.state.error && (
              <div className="mb-6 p-4 bg-surface rounded-lg text-left">
                <p className="text-xs font-mono text-ink-secondary break-all">
                  {this.state.error.message}
                </p>
              </div>
            )}
            <div className="flex gap-3">
              <button
                onClick={() => window.location.reload()}
                className="flex-1 flex items-center justify-center gap-2 h-11 px-4 bg-primary hover:brightness-95 text-white rounded-lg font-medium transition-all"
              >
                <RefreshCw className="w-4 h-4" strokeWidth={1.75} />
                Reload page
              </button>
              <Link
                href="/"
                className="flex-1 flex items-center justify-center gap-2 h-11 px-4 bg-white border border-border hover:bg-surface text-ink rounded-lg font-medium transition-all"
              >
                <Home className="w-4 h-4" strokeWidth={1.75} />
                Go home
              </Link>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export function ErrorMessage({
  title = 'Error',
  message,
  onRetry,
  className,
}: {
  title?: string;
  message: string;
  onRetry?: () => void;
  className?: string;
}) {
  return (
    <div className={`bg-danger/5 border border-danger/20 rounded-lg p-4 ${className || ''}`}>
      <div className="flex items-start gap-3">
        <AlertTriangle className="w-5 h-5 text-danger flex-shrink-0 mt-0.5" strokeWidth={1.75} />
        <div className="flex-1">
          <h3 className="text-sm font-medium text-ink">{title}</h3>
          <p className="text-sm text-ink-secondary mt-1">{message}</p>
          {onRetry && (
            <button
              onClick={onRetry}
              className="mt-3 text-sm font-medium text-danger hover:brightness-90 flex items-center gap-1"
            >
              <RefreshCw className="w-4 h-4" strokeWidth={1.75} />
              Try again
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

export function EmptyState({
  icon: Icon = AlertTriangle,
  title,
  message,
  action,
  className,
}: {
  icon?: any;
  title: string;
  message: string;
  action?: { label: string; onClick: () => void };
  className?: string;
}) {
  return (
    <div className={`flex flex-col items-center justify-center py-12 px-4 text-center ${className || ''}`}>
      <div className="w-12 h-12 bg-surface border border-border rounded-full flex items-center justify-center mb-4">
        <Icon className="w-6 h-6 text-ink-muted" strokeWidth={1.75} />
      </div>
      <h3 className="text-[16px] font-medium text-ink mb-2">{title}</h3>
      <p className="text-[15px] text-ink-secondary max-w-md mb-6">{message}</p>
      {action && (
        <button
          onClick={action.onClick}
          className="h-11 px-4 bg-primary hover:brightness-95 text-white rounded-lg font-medium transition-all"
        >
          {action.label}
        </button>
      )}
    </div>
  );
}
