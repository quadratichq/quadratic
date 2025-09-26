import { useConnectionSchemaBrowserTableQueryActionNewFile } from '@/dashboard/hooks/useConnectionSchemaBrowserTableQueryAction';
import { ConnectionSchemaBrowser } from '@/shared/components/connections/ConnectionSchemaBrowser';
import type { ConnectionType } from 'quadratic-shared/typesAndSchemasConnections';

export const ConnectionDetails = ({
  connectionType,
  connectionUuid,
  teamUuid,
  onTableQueryAction,
}: {
  connectionType: ConnectionType;
  connectionUuid: string;
  teamUuid: string;
  onTableQueryAction?: (query: string) => void;
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
      selfContained={false}
      TableQueryAction={TableQueryAction}
      onTableQueryAction={onTableQueryAction}
      uuid={connectionUuid}
      type={connectionType}
    />
  );
};
