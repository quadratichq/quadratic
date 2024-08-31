import React from 'react';

export function SlideUpBottomAlert({ children }: { children: React.ReactNode }) {
  return (
    <div className="pointer-events-none fixed bottom-16 left-1/2  z-10 flex w-[95%] max-w-xl -translate-x-1/2 animate-slide-up flex-row items-center justify-between gap-4 rounded border border-border bg-background px-4 py-3 shadow-lg transition-all duration-300 ease-in-out">
      {children}
    </div>
  );
}
