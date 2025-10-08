import { cn } from '@/shared/shadcn/utils';
import { memo } from 'react';

interface AILoadingProps {
  loading: boolean;
}
export const AILoading = memo(({ loading }: AILoadingProps) => {
  return (
    <div className={cn('flex flex-row gap-1 p-2 transition-opacity', !loading && 'opacity-0')}>
      <span className="h-2 w-2 animate-bounce bg-primary" />
      <span className="h-2 w-2 animate-bounce bg-primary/60 delay-100" />
      <span className="h-2 w-2 animate-bounce bg-primary/20 delay-200" />
    </div>
  );
});
