import { useConnectionSchemaBrowserTableQueryActionNewFile } from '@/dashboard/hooks/useConnectionSchemaBrowserTableQueryAction';
import { ConnectionHeader } from '@/shared/components/connections/ConnectionHeader';
import { ConnectionSchemaBrowser } from '@/shared/components/connections/ConnectionSchemaBrowser';
import type { ConnectionType } from 'quadratic-shared/typesAndSchemasConnections';

export const ConnectionDetails = ({
  connectionType,
  connectionUuid,
  handleNavigateToListView,
  teamUuid,
}: {
  connectionType: ConnectionType;
  connectionUuid: string;
  handleNavigateToListView: () => void;
  teamUuid: string;
}) => {
  const { TableQueryAction } = useConnectionSchemaBrowserTableQueryActionNewFile({
    connectionType,
    connectionUuid,
    isPrivate: true,
    teamUuid,
  });

  return (
    <div>
      <ConnectionHeader type={connectionType} handleNavigateToListView={handleNavigateToListView}>
        Browse
      </ConnectionHeader>

      <ConnectionSchemaBrowser
        teamUuid={teamUuid}
        selfContained={true}
        TableQueryAction={TableQueryAction}
        uuid={connectionUuid}
        type={connectionType}
      />
    </div>
  );
};
