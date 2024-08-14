import { ConnectionHeader } from '@/shared/components/connections/ConnectionHeader';
import { useSchemaBrowser } from '@/shared/hooks/useSchemaBrowser';
import { Button } from '@/shared/shadcn/ui/button';
import { ConnectionType } from 'quadratic-shared/typesAndSchemasConnections';

export const ConnectionDetails = ({
  connectionUuid,
  connectionType,
  handleNavigateToListView,
}: {
  connectionUuid: string;
  connectionType: ConnectionType;
  handleNavigateToListView: () => void;
}) => {
  const { SchemaBrowser } = useSchemaBrowser({ uuid: connectionUuid, type: connectionType });
  return (
    <div>
      <ConnectionHeader type={connectionType}>Browse</ConnectionHeader>
      <SchemaBrowser />
      <Button onClick={handleNavigateToListView} variant="outline">
        Back
      </Button>
    </div>
  );
};
