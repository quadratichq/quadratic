import { ConnectionHeader } from '@/shared/components/connections/ConnectionHeader';
import { connectionsByType } from '@/shared/components/connections/connectionsByType';
import { AddIcon } from '@/shared/components/Icons';
import { Button } from '@/shared/shadcn/ui/button';
import type { ConnectionType } from 'quadratic-shared/typesAndSchemasConnections';

export const ConnectionsNew = ({
  connectionType,
  handleNavigateToCreateView,
  handleNavigateToListView,
}: {
  connectionType: ConnectionType;
  handleNavigateToCreateView: (type: ConnectionType) => void;
  handleNavigateToListView: () => void;
}) => {
  return (
    <div>
      <ConnectionHeader handleNavigateToListView={handleNavigateToListView}>Create new connection</ConnectionHeader>

      <div className="grid grid-cols-2 gap-4">
        {Object.entries(connectionsByType).map(([type, { Logo }]) => (
          <Button
            key={type}
            variant="outline"
            className="group relative h-auto w-full"
            onClick={() => {
              handleNavigateToCreateView(type as ConnectionType);
            }}
          >
            <AddIcon className="absolute bottom-1 right-1 opacity-30 group-hover:opacity-100" />
            <Logo className="h-[40px] w-[160px]" />
          </Button>
        ))}
      </div>
    </div>
  );
};
