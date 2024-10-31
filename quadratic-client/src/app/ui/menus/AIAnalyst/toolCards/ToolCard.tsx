import { cn } from '@/shared/shadcn/utils';
import { CircularProgress } from '@mui/material';

export const ToolCard = ({
  icon,
  label,
  description,
  className,
  actions,
  isLoading,
}: {
  icon: React.ReactNode;
  label: string;
  description: string | React.ReactNode;
  className?: string;
  actions?: React.ReactNode;
  isLoading?: boolean;
}) => {
  return (
    <div
      className={cn(
        'mx-2 flex h-12 items-center justify-between gap-2 rounded border border-border bg-background p-2 text-sm shadow',
        className
      )}
    >
      <div className="flex items-center gap-2">
        <div className="flex h-6 w-6 items-center justify-center">{icon}</div>

        <div className="flex flex-col leading-tight">
          <span className="font-bold">{label}</span>
          <span className="text-xs text-muted-foreground">{description}</span>
        </div>
      </div>

      <div className="flex items-center pr-1 text-xs">{isLoading ? <CircularProgress size={14} /> : actions}</div>
    </div>
  );
};
