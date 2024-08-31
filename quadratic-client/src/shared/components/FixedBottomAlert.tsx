import React from 'react';

export function FixedBottomAlert({ children }: { children: React.ReactNode }) {
  return (
    <div className="fixed bottom-16 left-1/2 z-10  flex w-[95%] max-w-xl -translate-x-1/2 flex-row items-center justify-between gap-4 rounded border border-border bg-background px-4 py-3 shadow-lg">
      {children}
    </div>
  );
}
