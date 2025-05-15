//! Used to add a query to the AI (similar to a tool call, but will not change
//! the state of the grid).

import { Skeleton } from '@/shared/shadcn/ui/skeleton';
import { memo } from 'react';

export const ToolCardQuery = memo(
  ({
    label,
    hasError,
    className,
    actions,
    isLoading,
  }: {
    label?: string | React.ReactNode;
    hasError?: boolean;
    className?: string;
    actions?: React.ReactNode;
    isLoading?: boolean;
  }) => {
    return (
      <div className={className}>
        <div className="text-sm text-muted-foreground">{label ? label : isLoading ? <Skeleton /> : null}</div>
        <div className="text-muted-foreground">
          {hasError ? (
            <span className="text-destructive">Something went wrong (try again)</span>
          ) : isLoading ? (
            <Skeleton />
          ) : null}
        </div>

        <div className="flex shrink-0 items-center pr-1">{actions}</div>
      </div>
    );
  }
);

export function getRowColSentence({ rows, cols }: { rows: number; cols: number }) {
  if (rows === 1 && cols === 1) {
    return '1 cell';
  }

  return `${rows} row${rows === 1 ? '' : 's'} × ${cols} col${cols === 1 ? '' : 's'}`;
}
