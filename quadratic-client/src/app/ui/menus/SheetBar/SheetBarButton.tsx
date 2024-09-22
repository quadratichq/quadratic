import { Button, ButtonProps } from '@/shared/shadcn/ui/button';
import { TooltipPopover } from '@/shared/shadcn/ui/tooltip';

interface Props extends ButtonProps {
  buttonRef?: any;
  tooltip: string;
}

export const SheetBarButton = ({ children, buttonRef, tooltip, className, ...rest }: Props) => {
  const buttonProps = {
    ...rest,
    ...(buttonRef ? { ref: buttonRef } : {}),
    className: `h-full px-5 ${className ? className : ''}`,
  };

  return (
    <TooltipPopover label={tooltip ?? ''}>
      <Button variant="ghost" size="icon-sm" {...buttonProps}>
        {children}
      </Button>
    </TooltipPopover>
  );
};
