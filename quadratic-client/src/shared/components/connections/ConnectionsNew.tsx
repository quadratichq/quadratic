import type { NavigateToCreatePotentialView, NavigateToCreateView } from '@/shared/components/connections/Connections';
import {
  connectionsByType,
  potentialConnectionsByType,
  type PotentialConnectionType,
} from '@/shared/components/connections/connectionsByType';
import { Button } from '@/shared/shadcn/ui/button';
import { cn } from '@/shared/shadcn/utils';
import type { ConnectionType } from 'quadratic-shared/typesAndSchemasConnections';

export const ConnectionsNew = ({
  activeConnectionType,
  handleNavigateToCreateView,
  handleNavigateToCreatePotentialView,
}: {
  activeConnectionType?: ConnectionType;
  handleNavigateToCreateView: NavigateToCreateView;
  handleNavigateToCreatePotentialView: NavigateToCreatePotentialView;
}) => {
  return (
    <div className="grid grid-cols-1 gap-4">
      {Object.entries(connectionsByType).map(([type, { Logo }]) => (
        <Button
          data-testid={`new-connection-${type}`}
          key={type}
          variant="ghost"
          className={cn('group relative h-auto w-full', activeConnectionType === type && 'bg-accent')}
          onClick={() => {
            handleNavigateToCreateView(type as ConnectionType);
          }}
        >
          <Logo className="h-[40px] w-[160px]" />
        </Button>
      ))}
      {Object.entries(potentialConnectionsByType).map(([type, { Logo }]) => (
        <Button
          data-testid={`new-connection-${type}`}
          key={type}
          className="group relative h-auto w-full"
          variant="ghost"
          onClick={() => {
            handleNavigateToCreatePotentialView(type as PotentialConnectionType);
          }}
        >
          <Logo className="h-[40px] w-[160px]" />
        </Button>
      ))}
    </div>
  );
};
