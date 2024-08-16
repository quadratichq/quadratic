import { useSchemaBrowserTableQueryActionNewFile } from '@/dashboard/hooks/useSchemaBrowserTableQueryActionNewFile';
import { ConnectionHeader } from '@/shared/components/connections/ConnectionHeader';
import { SchemaBrowser } from '@/shared/hooks/useSchemaBrowser';
import { Button } from '@/shared/shadcn/ui/button';
import { ConnectionType } from 'quadratic-shared/typesAndSchemasConnections';

export const ConnectionDetails = ({
  connectionType,
  connectionUuid,
  handleNavigateToListView,
}: {
  connectionType: ConnectionType;
  connectionUuid: string;
  handleNavigateToListView: () => void;
}) => {
  const { tableQueryAction } = useSchemaBrowserTableQueryActionNewFile();
  return (
    <div>
      <ConnectionHeader type={connectionType}>Browse</ConnectionHeader>

      <SchemaBrowser
        selfContained={true}
        tableQueryAction={tableQueryAction}
        connectionUuid={connectionUuid}
        connectionType={connectionType}
      />

      <Button onClick={handleNavigateToListView} variant="outline" className="mt-4">
        Back
      </Button>
    </div>
  );
};
