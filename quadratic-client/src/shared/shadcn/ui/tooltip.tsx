import * as TooltipPrimitive from '@radix-ui/react-tooltip';
import * as React from 'react';

import { cn } from '@/shared/shadcn/utils';
import { PopoverContentProps } from '@radix-ui/react-popover';

const TooltipProvider = TooltipPrimitive.Provider;

const Tooltip = TooltipPrimitive.Root;

const TooltipTrigger = TooltipPrimitive.Trigger;

const TooltipPortal = TooltipPrimitive.Portal;

const TooltipContent = React.forwardRef<
  React.ElementRef<typeof TooltipPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof TooltipPrimitive.Content>
>(({ className, sideOffset = 4, ...props }, ref) => (
  <TooltipPrimitive.Content
    ref={ref}
    sideOffset={sideOffset}
    className={cn(
      'z-50 overflow-hidden rounded-md bg-foreground px-3 py-1.5 text-xs text-primary-foreground animate-in fade-in-0 zoom-in-95 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2 dark:text-background',
      className
    )}
    {...props}
  />
));
TooltipContent.displayName = TooltipPrimitive.Content.displayName;

/**
 * Convenience component for simple tooltips
 * @example
 * <TooltipPopover label="This is a tooltip">
 *   <Button>Hover me</Button>
 * </TooltipPopover>
 */
const TooltipPopover = ({
  label,
  children,
  shortcut,
  side,
}: {
  label: string;
  children: React.ReactNode;
  shortcut?: string;
  side?: PopoverContentProps['side'];
}) => {
  return (
    <Tooltip>
      <TooltipTrigger asChild>{children}</TooltipTrigger>
      <TooltipPortal>
        <TooltipContent side={side}>
          <p>
            {label} {shortcut && <span className="opacity-50">({shortcut})</span>}
          </p>
        </TooltipContent>
      </TooltipPortal>
    </Tooltip>
  );
};

export { Tooltip, TooltipContent, TooltipPopover, TooltipPortal, TooltipProvider, TooltipTrigger };
