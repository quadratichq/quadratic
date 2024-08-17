import { useConnectionSchemaBrowserTableQueryActionNewFile } from '@/dashboard/hooks/useConnectionSchemaBrowserTableQueryActionNewFile';
import { ConnectionHeader } from '@/shared/components/connections/ConnectionHeader';
import { ConnectionSchemaBrowser } from '@/shared/components/connections/ConnectionSchemaBrowser';
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
  const { tableQueryAction } = useConnectionSchemaBrowserTableQueryActionNewFile();
  return (
    <div>
      <ConnectionHeader type={connectionType} handleNavigateToListView={handleNavigateToListView}>
        Browse
      </ConnectionHeader>

      <ConnectionSchemaBrowser
        selfContained={true}
        tableQueryAction={tableQueryAction}
        uuid={connectionUuid}
        type={connectionType}
      />
    </div>
  );
};
