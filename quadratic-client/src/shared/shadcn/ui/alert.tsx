import { cva, type VariantProps } from 'class-variance-authority';
import * as React from 'react';

import { cn } from '@/shared/shadcn/utils';

const alertVariants = cva(
  'relative w-full rounded-lg border px-3 py-3 text-sm [&>.material-symbols-outlined+div]:translate-y-[-3px] [&>.material-symbols-outlined]:absolute [&>.material-symbols-outlined]:left-3 [&>.material-symbols-outlined]:top-2.5 [&>.material-symbols-outlined]:text-foreground [&>.material-symbols-outlined~*]:pl-7',
  {
    variants: {
      variant: {
        default: 'bg-background text-foreground',
        success: 'border-success bg-background [&>h5]:text-success [&>.material-symbols-outlined]:text-success',
        warning:
          'border-yellow-200 bg-yellow-50 [&>h5]:text-yellow-900 dark:border-yellow-200/40 dark:bg-yellow-200/10 dark:[&>h5]:text-yellow-200 dark:[&>.material-symbols-outlined]:text-yellow-200 [&>.material-symbols-outlined]:text-yellow-900',
        destructive:
          'border-destructive/50 dark:border-destructive [&>h5]:text-destructive [&>.material-symbols-outlined]:text-destructive',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  }
);

const Alert = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement> & VariantProps<typeof alertVariants>
>(({ className, variant, ...props }, ref) => (
  <div ref={ref} role="alert" className={cn(alertVariants({ variant }), className)} {...props} />
));
Alert.displayName = 'Alert';

const AlertTitle = React.forwardRef<HTMLHeadingElement, React.HTMLAttributes<HTMLHeadingElement>>(
  ({ className, children, ...props }, ref) => (
    <h5 ref={ref} className={cn('mb-1 font-medium leading-none tracking-tight', className)} {...props}>
      {children || 'Alert'}
    </h5>
  )
);
AlertTitle.displayName = 'AlertTitle';

const AlertDescription = React.forwardRef<HTMLParagraphElement, React.HTMLAttributes<HTMLParagraphElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn('text-sm [&_p]:leading-relaxed', className)} {...props} />
  )
);
AlertDescription.displayName = 'AlertDescription';

export { Alert, AlertDescription, AlertTitle };
