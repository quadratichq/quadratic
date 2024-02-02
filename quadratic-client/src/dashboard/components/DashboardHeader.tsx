import { ReactNode, useEffect } from 'react';
import { TYPE } from '../../constants/appConstants';

export function DashboardHeader({
  title,
  actions,
  titleStart,
  titleEnd,
}: {
  title: string;
  actions?: ReactNode;
  titleStart?: ReactNode;
  titleEnd?: ReactNode;
}) {
  useEffect(() => {
    document.title = `${title} - Quadratic`;
  }, [title]);

  return (
    <header className={`flex min-h-[60px] flex-row items-center justify-between pb-2 pt-3`}>
      <div className="flex items-center">
        {titleStart}
        <h1 className={`${TYPE.h4} p-0`}>{title}</h1>
        {titleEnd}
      </div>

      {actions && <div className={`hidden lg:block`}>{actions}</div>}
    </header>
  );
}
