import { cn } from '@/shadcn/utils';
import { StopwatchIcon } from '@radix-ui/react-icons';
import { ReactNode } from 'react';
import { TYPE } from '../constants/appConstants';

export function Empty({
  title,
  description,
  actions,
  Icon,
  severity,
  className,
}: {
  title: String;
  description: ReactNode;
  actions?: ReactNode;
  Icon: typeof StopwatchIcon;
  severity?: 'error';
  className?: string;
}) {
  return (
    <div className={cn(`max-w mx-auto my-10 max-w-md px-2 text-center`, className)}>
      <div
        className={`mx-auto mb-6 flex h-16 w-16 items-center justify-center border border-border text-muted-foreground`}
      >
        <Icon className={cn(`h-[30px] w-[30px]`, severity === 'error' && 'text-destructive')} />
      </div>
      <h4 className={cn(TYPE.h4, `mb-1`, severity === 'error' && 'text-destructive')}>{title}</h4>

      <div className={`text-sm text-muted-foreground`}>{description}</div>

      {actions && <div className={`mt-8`}>{actions}</div>}
    </div>
  );
}
