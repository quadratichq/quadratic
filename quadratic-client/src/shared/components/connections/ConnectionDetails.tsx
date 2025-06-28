import { useConnectionSchemaBrowserTableQueryActionNewFile } from '@/dashboard/hooks/useConnectionSchemaBrowserTableQueryAction';
import { ConnectionSchemaBrowser } from '@/shared/components/connections/ConnectionSchemaBrowser';
import type { ConnectionType } from 'quadratic-shared/typesAndSchemasConnections';

export const ConnectionDetails = ({
  connectionType,
  connectionUuid,
  teamUuid,
}: {
  connectionType: ConnectionType;
  connectionUuid: string;
  teamUuid: string;
}) => {
  const { TableQueryAction } = useConnectionSchemaBrowserTableQueryActionNewFile({
    connectionType,
    connectionUuid,
    isPrivate: true,
    teamUuid,
  });

  return (
    <ConnectionSchemaBrowser
      teamUuid={teamUuid}
      selfContained={true}
      TableQueryAction={TableQueryAction}
      uuid={connectionUuid}
      type={connectionType}
    />
  );
};
