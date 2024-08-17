import { useSchemaBrowserTableQueryActionNewFile } from '@/dashboard/hooks/useSchemaBrowserTableQueryActionNewFile';
import { ConnectionHeader } from '@/shared/components/connections/ConnectionHeader';
import { SchemaBrowser } from '@/shared/hooks/useSchemaBrowser';
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
      <ConnectionHeader type={connectionType} handleNavigateToListView={handleNavigateToListView}>
        Browse
      </ConnectionHeader>

      <SchemaBrowser
        selfContained={true}
        tableQueryAction={tableQueryAction}
        connectionUuid={connectionUuid}
        connectionType={connectionType}
      />
    </div>
  );
};
