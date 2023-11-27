import { ReactNode, useEffect } from 'react';
import { TYPE } from '../../constants/appConstants';

export function DashboardHeader({ title, actions }: { title: string; actions?: ReactNode }) {
  useEffect(() => {
    document.title = `${title} - Quadratic`;
  }, [title]);

  return (
    <header className={`flex min-h-[60px] flex-row items-center justify-between pb-2 pt-3`}>
      <h1 className={`${TYPE.h4} p-0`}>{title}</h1>

      {actions && <div className={`hidden lg:block`}>{actions}</div>}
    </header>
  );
}
