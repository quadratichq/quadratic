import type { NavigateToCreateView } from '@/shared/components/connections/Connections';
import { connectionsByType } from '@/shared/components/connections/connectionsByType';
import { AddIcon } from '@/shared/components/Icons';
import { Button } from '@/shared/shadcn/ui/button';
import type { ConnectionType } from 'quadratic-shared/typesAndSchemasConnections';

export const ConnectionsNew = ({
  handleNavigateToCreateView,
}: {
  handleNavigateToCreateView: NavigateToCreateView;
}) => {
  return (
    <div className="grid grid-cols-2 gap-4">
      {Object.entries(connectionsByType).map(([type, { Logo }]) => (
        <Button
          data-testid={`new-connection-${type}`}
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
  );
};
