import { cn } from '@/shared/shadcn/utils';
import { memo } from 'react';

interface AILoadingProps {
  loading: boolean;
}
export const AILoading = memo(({ loading }: AILoadingProps) => {
  return (
    <div className={cn('flex flex-row gap-1 p-2 transition-opacity', !loading && 'opacity-0')}>
      <span className="h-2 w-2 animate-bounce" style={{ backgroundColor: '#a855f7' }} />
      <span className="h-2 w-2 animate-bounce delay-100" style={{ backgroundColor: '#a855f799' }} />
      <span className="h-2 w-2 animate-bounce delay-200" style={{ backgroundColor: '#a855f733' }} />
    </div>
  );
});
