import { Skeleton } from '@/shared/shadcn/ui/skeleton';
import { cn } from '@/shared/shadcn/utils';
import { memo } from 'react';

export const ToolCard = memo(
  ({
    icon,
    label,
    description,
    hasError,
    className,
    actions,
    isLoading,
    compact,
    outlined,
  }: {
    icon?: React.ReactNode;
    label?: string | React.ReactNode;
    description?: string | React.ReactNode;
    hasError?: boolean;
    className: string;
    actions?: React.ReactNode;
    isLoading?: boolean;
    compact?: boolean;
    outlined?: boolean;
  }) => {
    // Compact mode: render as inline text
    if (compact) {
      return (
        <div
          className={cn(
            'flex min-w-0 select-none items-center gap-1.5 text-[13px] text-foreground',
            outlined && 'rounded border border-border bg-background px-2 py-1 shadow-sm',
            className
          )}
        >
          {icon && <div className="flex h-4 w-4 shrink-0 items-center justify-center">{icon}</div>}
          <span className="min-w-0 truncate">
            {label}
            {description && (
              <>
                {' '}
                <span className="text-muted-foreground">• {description}</span>
              </>
            )}
          </span>
          {hasError && <span className="text-destructive"> (error)</span>}
          {actions && <div className="ml-auto flex shrink-0 items-center">{actions}</div>}
        </div>
      );
    }

    // Full box mode (original)
    return (
      <div
        className={cn(
          'flex h-12 min-w-0 select-none items-center justify-between gap-2 rounded border border-border bg-background p-2 text-sm shadow-sm',
          className
        )}
      >
        <div className="flex min-w-0 items-center gap-2">
          <div className="flex h-6 w-6 shrink-0 select-none items-center justify-center">
            {icon ? icon : isLoading ? <Skeleton className="h-6 w-6 bg-accent" /> : null}
          </div>

          <div className="min-w-0 flex-1">
            <div className="truncate font-bold">
              {label ? label : isLoading ? <Skeleton className="h-3 w-64 bg-accent" /> : null}
            </div>
            <div className="h-4 truncate text-xs text-muted-foreground">
              {hasError ? (
                <span className="text-destructive">Something went wrong (try again)</span>
              ) : description ? (
                description
              ) : isLoading ? (
                <Skeleton className="h-3 w-24 bg-accent" />
              ) : null}
            </div>
          </div>
        </div>

        <div className="flex shrink-0 items-center pr-1 text-xs">{actions}</div>
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
