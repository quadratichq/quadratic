import { connectionsByType } from '@/shared/components/connections/connectionsByType';
import { Button } from '@/shared/shadcn/ui/button';
import { ArrowLeftIcon } from '@radix-ui/react-icons';
import type { ConnectionType } from 'quadratic-shared/typesAndSchemasConnections';
import type { ReactNode } from 'react';

export const ConnectionHeader = ({
  type,
  children,
  handleNavigateToListView,
}: {
  type: ConnectionType;
  children: ReactNode;
  handleNavigateToListView: () => void;
}) => {
  const { name } = connectionsByType[type];
  return (
    <div className="flex items-center gap-2">
      <Button variant="ghost" size="icon" onClick={handleNavigateToListView}>
        <ArrowLeftIcon />
      </Button>
      <h3 className="text-md flex items-center justify-between gap-3 py-4">
        {children} {name} connection
      </h3>
    </div>
  );
};
