import {
  ConnectionSchemaBrowser,
  type SchemaBrowserTableActionOnClick,
} from '@/shared/components/connections/ConnectionSchemaBrowser';
import { FileIcon } from '@/shared/components/Icons';
import { newNewFileFromStateConnection } from '@/shared/hooks/useNewFileFromState';
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
  const handleClick = ({ tableQuery }: SchemaBrowserTableActionOnClick) => {
    const to = newNewFileFromStateConnection({
      isPrivate: true,
      teamUuid,
      query: tableQuery,
      connectionType,
      connectionUuid,
    });
    // eslint-disable-next-line react-compiler/react-compiler
    window.location.href = to;
  };

  return (
    <ConnectionSchemaBrowser
      teamUuid={teamUuid}
      tableActions={[
        {
          label: 'Create file querying this table',
          Icon: FileIcon,
          onClick: handleClick,
        },
      ]}
      uuid={connectionUuid}
      type={connectionType}
      eventSource="dashboard"
    />
  );
};
