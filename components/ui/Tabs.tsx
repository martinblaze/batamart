'use client';

import { createContext, useContext, useState, ReactNode } from 'react';
import { cn } from '@/lib/utils';

interface TabsContextValue {
  value: string;
  setValue: (v: string) => void;
}

const TabsContext = createContext<TabsContextValue | null>(null);

function useTabsContext() {
  const ctx = useContext(TabsContext);
  if (!ctx) throw new Error('Tabs.* components must be used inside <Tabs>');
  return ctx;
}

interface TabsProps {
  defaultValue: string;
  value?: string;
  onValueChange?: (v: string) => void;
  children: ReactNode;
  className?: string;
}

// Design bible section 8 — Tabs. One canonical implementation: underline
// style, active tab in --color-primary, everything else neutral text.
export function Tabs({ defaultValue, value, onValueChange, children, className }: TabsProps) {
  const [internalValue, setInternalValue] = useState(defaultValue);
  const active = value ?? internalValue;
  const setValue = (v: string) => {
    setInternalValue(v);
    onValueChange?.(v);
  };

  return (
    <TabsContext.Provider value={{ value: active, setValue }}>
      <div className={className}>{children}</div>
    </TabsContext.Provider>
  );
}

export function TabsList({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div
      role="tablist"
      className={cn('flex items-center gap-1 border-b border-border overflow-x-auto scrollbar-hide', className)}
    >
      {children}
    </div>
  );
}

export function TabsTrigger({ value, children, className }: { value: string; children: ReactNode; className?: string }) {
  const { value: active, setValue } = useTabsContext();
  const isActive = active === value;

  return (
    <button
      role="tab"
      aria-selected={isActive}
      onClick={() => setValue(value)}
      className={cn(
        'relative px-4 py-3.5 text-sm font-medium whitespace-nowrap',
        'transition-colors duration-300 ease-out',
        // The active tab goes to ink rather than to the accent: with the rule
        // underneath already carrying the accent, colouring the label too
        // makes a row of tabs read as a row of links.
        isActive ? 'text-ink' : 'text-ink-secondary hover:text-ink',
        className
      )}
    >
      {children}
      <span
        aria-hidden
        className={cn(
          'absolute left-0 right-0 -bottom-px h-[2px] bg-primary origin-left',
          'transition-transform duration-500 ease-out',
          isActive ? 'scale-x-100' : 'scale-x-0'
        )}
      />
    </button>
  );
}

export function TabsContent({ value, children, className }: { value: string; children: ReactNode; className?: string }) {
  const { value: active } = useTabsContext();
  if (active !== value) return null;
  return (
    <div role="tabpanel" className={className}>
      {children}
    </div>
  );
}
