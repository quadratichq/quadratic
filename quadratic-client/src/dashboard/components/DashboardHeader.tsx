import { TYPE } from '@/shared/constants/appConstants';
import type { ReactNode } from 'react';
import { useEffect } from 'react';

export function DashboardHeader({
  title,
  actions,
  titleNode,
  titleStart,
  titleEnd,
}: {
  title: string;
  titleNode?: ReactNode;
  actions?: ReactNode;
  titleStart?: ReactNode;
  titleEnd?: ReactNode;
}) {
  useEffect(() => {
    document.title = `${title} - Quadratic`;
  }, [title]);

  return (
    <header
      className={`flex min-h-[60px] flex-col gap-2 pb-2 pt-3 sm:flex-row sm:items-center sm:justify-between sm:gap-0`}
    >
      <div className="flex min-w-0 flex-1 items-center">
        {titleStart}
        {titleNode ? titleNode : <DashboardHeaderTitle>{title}</DashboardHeaderTitle>}
        {titleEnd}
      </div>

      {actions && <div className={`lg:block`}>{actions}</div>}
    </header>
  );
}

export function DashboardHeaderTitle({ children }: { children: ReactNode }) {
  return <h1 className={`${TYPE.h4} p-0 text-left leading-5`}>{children}</h1>;
}
