import type { NavigateToListView } from '@/shared/components/connections/Connections';
import { connectionsByType } from '@/shared/components/connections/connectionsByType';
import { ArrowBackIcon } from '@/shared/components/Icons';
import { Button } from '@/shared/shadcn/ui/button';
import type { ConnectionType } from 'quadratic-shared/typesAndSchemasConnections';
import type { ReactNode } from 'react';

export const ConnectionHeader = ({
  type,
  children,
  handleNavigateToListView,
}: {
  type?: ConnectionType;
  children: ReactNode;
  handleNavigateToListView: NavigateToListView;
}) => {
  const suffix = type && connectionsByType[type] ? ` ${connectionsByType[type].name} connection` : '';

  return (
    <div className="flex items-center gap-2 pb-3">
      <Button variant="ghost" size="icon" onClick={handleNavigateToListView}>
        <ArrowBackIcon />
      </Button>
      <h3 className="text-md flex items-center justify-between gap-3">
        {children} {suffix}
      </h3>
    </div>
  );
};
