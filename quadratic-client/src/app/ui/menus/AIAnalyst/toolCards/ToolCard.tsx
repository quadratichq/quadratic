import { Skeleton } from '@/shared/shadcn/ui/skeleton';
import { cn } from '@/shared/shadcn/utils';

export const ToolCard = ({
  icon,
  label,
  description,
  hasError,
  className,
  actions,
  isLoading,
}: {
  icon?: React.ReactNode;
  label?: string;
  description?: string | React.ReactNode;
  hasError?: boolean;
  className?: string;
  actions?: React.ReactNode;
  isLoading?: boolean;
}) => {
  return (
    <div
      className={cn(
        'flex h-12 items-center justify-between gap-2 rounded border border-border bg-background p-2 text-sm shadow',
        className
      )}
    >
      <div className="flex items-center gap-2">
        <div className="flex h-6 w-6 items-center justify-center">
          {icon ? icon : isLoading ? <Skeleton className="h-6 w-6 bg-accent" /> : null}
        </div>

        <div className="flex flex-col">
          <span className="flex h-5 items-center font-bold">
            {label ? label : isLoading ? <Skeleton className="h-3 w-64 bg-accent" /> : null}
          </span>
          <span className="-mt-0.5 flex h-4 items-center text-xs text-muted-foreground">
            {hasError ? (
              <span className="text-destructive">Something went wrong (try again)</span>
            ) : description ? (
              description
            ) : isLoading ? (
              <Skeleton className="h-2 w-24 bg-accent" />
            ) : null}
          </span>
        </div>
      </div>

      <div className="flex items-center pr-1 text-xs">{actions}</div>
    </div>
  );
};

export function getRowColSentence({ rows, cols }: { rows: number; cols: number }) {
  if (rows === 1 && cols === 1) {
    return '1 cell';
  }

  return `${rows} row${rows === 1 ? '' : 's'} × ${cols} col${cols === 1 ? '' : 's'}`;
}
