import { useSyncedConnection } from '@/app/atoms/useSyncedConnection';
import { timeAgo } from '@/shared/utils/timeAgo';
import { type SyncedConnectionLog } from 'quadratic-shared/typesAndSchemasConnections';
import { useEffect, useState } from 'react';

export const SyncedConnectionLogs = ({ connectionUuid, teamUuid }: { connectionUuid: string; teamUuid: string }) => {
  const { getLogs, showLogs } = useSyncedConnection(connectionUuid, teamUuid);
  const [logs, setLogs] = useState<SyncedConnectionLog[]>([]);

  useEffect(() => {
    if (connectionUuid && showLogs) {
      getLogs(1, 100).then((logs) => setLogs(logs));
    }
  }, [connectionUuid, getLogs, showLogs]);

  return (
    <div className="max-h-40 min-h-0 flex-1 overflow-y-auto rounded border px-2 py-1 shadow-sm">
      {logs.map((log: SyncedConnectionLog) => (
        <p key={log.id} className="mb-2 mt-2 text-xs">
          {log.status === 'COMPLETED' && `Synced "${log.syncedDates.join('", "')}" `} {timeAgo(log.createdDate)}
        </p>
      ))}
    </div>
  );
};

export const SyncedConnection = ({
  connectionUuid,
  teamUuid,
  createdDate,
}: {
  connectionUuid: string;
  teamUuid: string;
  createdDate?: string;
}) => {
  const { syncedConnection, syncState } = useSyncedConnection(connectionUuid, teamUuid);

  const renderSyncStatus = () => {
    switch (syncState) {
      case 'not_synced':
        return 'Not synced';
      case 'syncing':
        return `${syncedConnection.percentCompleted}% synced`;
      case 'synced':
        return syncedConnection.updatedDate ? `Last synced ${timeAgo(syncedConnection.updatedDate)}` : 'Synced';
      case 'failed':
        return 'Sync failed';
    }
  };

  return (
    <>
      {renderSyncStatus()}
      {createdDate && ` · Created ${timeAgo(createdDate)}`}
    </>
  );
};
