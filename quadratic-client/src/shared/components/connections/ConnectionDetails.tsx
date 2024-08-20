import { useConnectionSchemaBrowserTableQueryActionNewFile } from '@/dashboard/hooks/useConnectionSchemaBrowserTableQueryAction';
import { ConnectionHeader } from '@/shared/components/connections/ConnectionHeader';
import { ConnectionSchemaBrowser } from '@/shared/components/connections/ConnectionSchemaBrowser';
import { PrivateFileToggle } from '@/shared/components/connections/PrivateFileToggle';
import { ConnectionType } from 'quadratic-shared/typesAndSchemasConnections';
import { useState } from 'react';

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
  const [isPrivate, setIsPrivate] = useState<boolean>(true);

  // From this view, you're not really in the explicit context of a team. So we decide
  // to create it manually as a public team file.
  const { TableQueryAction } = useConnectionSchemaBrowserTableQueryActionNewFile({
    connectionType,
    connectionUuid,
    isPrivate: false,
    teamUuid,
  });

  return (
    <div>
      <ConnectionHeader type={connectionType} handleNavigateToListView={handleNavigateToListView}>
        Browse
      </ConnectionHeader>

      <PrivateFileToggle className="mb-4" isPrivate={isPrivate} onToggle={() => setIsPrivate((prev) => !prev)}>
        Make new file private
      </PrivateFileToggle>

      <ConnectionSchemaBrowser
        selfContained={true}
        TableQueryAction={TableQueryAction}
        uuid={connectionUuid}
        type={connectionType}
      />
    </div>
  );
};
