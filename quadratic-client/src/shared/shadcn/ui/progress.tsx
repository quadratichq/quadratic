import { cn } from '@/shared/shadcn/utils';
import { Progress as ProgressPrimitive } from 'radix-ui';
import * as React from 'react';

interface ProgressProps extends React.ComponentPropsWithoutRef<typeof ProgressPrimitive.Root> {
  variant?: 'default' | 'primary' | 'destructive';
}

const Progress = React.forwardRef<React.ElementRef<typeof ProgressPrimitive.Root>, ProgressProps>(
  ({ className, value, variant = 'default', ...props }, ref) => (
    <ProgressPrimitive.Root
      ref={ref}
      className={cn(
        'relative h-4 w-full overflow-hidden rounded',
        variant === 'default' ? 'bg-foreground/10' : variant === 'destructive' ? 'bg-destructive/10' : 'bg-primary/20',
        className
      )}
      {...props}
    >
      <ProgressPrimitive.Indicator
        className={cn(
          'h-full w-full flex-1 rounded transition-all',
          variant === 'default' ? 'bg-foreground' : variant === 'destructive' ? 'bg-destructive' : 'bg-primary'
        )}
        style={{ transform: `translateX(-${100 - (value ? (value > 100 ? 100 : value) : 0)}%)` }}
      />
    </ProgressPrimitive.Root>
  )
);
Progress.displayName = ProgressPrimitive.Root.displayName;

export { Progress };
