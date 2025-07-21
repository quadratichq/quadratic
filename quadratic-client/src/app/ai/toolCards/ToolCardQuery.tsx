//! Used to add a query to the AI (similar to a tool call, but will not change
//! the state of the grid).

import { SearchIcon } from '@/shared/components/Icons';
import { cn } from '@/shared/shadcn/utils';
import { memo } from 'react';

export const ToolCardQuery = memo(
  ({
    label,
    hasError,
    className,
    isLoading,
  }: {
    label: string | React.ReactNode;
    hasError?: boolean;
    className: string;
    isLoading?: boolean;
  }) => {
    return (
      <div className={className}>
        <div
          className={cn(
            'flex select-none items-center text-sm text-muted-foreground',
            isLoading &&
              // Black shimmer (better for readability)
              'bg-[linear-gradient(to_left,hsl(var(--foreground))_0%,hsl(var(--muted-foreground))_10%,hsl(var(--muted-foreground))_90%,hsl(var(--foreground))_100%)]',
            // White shimmer
            // 'bg-[linear-gradient(to_left,hsl(var(--muted-foreground)/0)_0%,hsl(var(--muted-foreground))_20%,hsl(var(--muted-foreground))_80%,hsl(var(--muted-foreground)/0)_100%)]',
            isLoading && 'animate-shimmer bg-[length:200%_100%] bg-clip-text text-transparent'
          )}
        >
          <SearchIcon className="mr-1 scale-75 text-muted-foreground" />
          {label}
        </div>
        {hasError && <p className="pl-6 text-xs text-destructive">Something went wrong (try again)</p>}
      </div>
    );
  }
);
