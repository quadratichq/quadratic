import { StopwatchIcon } from '@radix-ui/react-icons';
import clsx from 'clsx';
import { ReactNode } from 'react';
import { TYPE } from '../constants/appConstants';

export function Empty({
  title,
  description,
  actions,
  Icon,
  severity,
}: {
  title: String;
  description: ReactNode;
  actions?: ReactNode;
  Icon: typeof StopwatchIcon;
  severity?: 'error';
}) {
  return (
    <div className={`max-w mx-auto my-10 max-w-md px-2 text-center`}>
      <div
        className={`mx-auto mb-6 flex h-16 w-16 items-center justify-center border border-border text-muted-foreground`}
      >
        <Icon className={clsx(`h-[30px] w-[30px]`, severity === 'error' && 'text-destructive')} />
      </div>
      <h4 className={`${TYPE.h4} mb-1 ${severity === 'error' && 'text-destructive'}`}>{title}</h4>

      <p className="text-sm text-muted-foreground">{description}</p>

      {actions && <div className={`mt-6`}>{actions}</div>}
    </div>
  );
}
