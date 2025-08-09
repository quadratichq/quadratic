import type { ButtonProps } from '@/shared/shadcn/ui/button';
import { Button } from '@/shared/shadcn/ui/button';
import { TooltipPopover } from '@/shared/shadcn/ui/tooltip';
import { memo } from 'react';

interface Props extends ButtonProps {
  buttonRef?: any;
  tooltip: string;
}

export const SheetBarButton = memo(({ children, buttonRef, tooltip, className, ...rest }: Props) => {
  const buttonProps = {
    ...rest,
    ...(buttonRef ? { ref: buttonRef } : {}),
    className: `h-full px-5 ${className ? className : ''}`,
  };

  return (
    <TooltipPopover label={tooltip ?? ''}>
      <Button variant="ghost" size="icon-sm" data-testid="sheet-bar-button" {...buttonProps}>
        {children}
      </Button>
    </TooltipPopover>
  );
});
