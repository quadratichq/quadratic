import { SpinnerIcon } from '@/shared/components/Icons';
import { cn } from '@/shared/shadcn/utils';
import { cva, type VariantProps } from 'class-variance-authority';
import { Slot as SlotPrimitive } from 'radix-ui';
import * as React from 'react';

const buttonVariants = cva(
  'inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50',
  {
    variants: {
      variant: {
        default: 'bg-primary text-primary-foreground shadow hover:bg-primary/90',
        destructive: 'bg-destructive text-destructive-foreground shadow-sm hover:bg-destructive/90',
        outline: 'border border-input bg-transparent shadow-sm hover:bg-accent hover:text-accent-foreground',
        'outline-destructive':
          'border border-destructive/20 bg-transparent text-destructive shadow-sm hover:bg-destructive/5',
        success: 'bg-success text-background shadow hover:bg-success/90',
        secondary: 'bg-secondary text-secondary-foreground shadow-sm hover:bg-secondary/80',
        ghost: 'hover:bg-accent hover:text-accent-foreground',
        link: 'text-primary underline-offset-4 hover:underline',
      },
      size: {
        default: 'h-9 px-4 py-2',
        sm: 'h-8 rounded-md px-3 text-xs',
        lg: 'h-10 rounded-md px-8',
        icon: 'h-9 w-9',
        'icon-sm': 'h-7 w-7',
        none: '',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
  loading?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, children, asChild = false, loading = false, disabled, ...props }, ref) => {
    const Comp = asChild ? SlotPrimitive.Slot : 'button';
    const content = (
      <>
        {children}
        {loading && (
          <span
            className={cn('absolute inset-0 flex items-center justify-center', getLoadingBackgroundByVariant(variant))}
          >
            <SpinnerIcon />
          </span>
        )}
      </>
    );
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }), loading && 'relative overflow-hidden')}
        ref={ref}
        disabled={disabled || loading}
        {...props}
      >
        {asChild ? children : content}
      </Comp>
    );
  }
);
Button.displayName = 'Button';

export { Button, buttonVariants };

function getLoadingBackgroundByVariant(variant: VariantProps<typeof buttonVariants>['variant']) {
  switch (variant) {
    case 'destructive':
      return 'bg-destructive';
    case 'outline':
      return 'bg-background';
    case 'outline-destructive':
      return 'bg-destructive/10';
    case 'success':
      return 'bg-success';
    case 'secondary':
      return 'bg-secondary';
    case 'ghost':
      return 'bg-background';
    case 'link':
      return 'bg-background';
    case 'default':
    default:
      return 'bg-primary';
  }
}
