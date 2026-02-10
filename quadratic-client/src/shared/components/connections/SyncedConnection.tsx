import { useSyncedConnection } from '@/app/atoms/useSyncedConnection';
import { Badge } from '@/shared/shadcn/ui/badge';
import { cn } from '@/shared/shadcn/utils';
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

  const lastSync = syncState === 'synced' && syncedConnection.updatedDate && (
    <span>Last synced {timeAgo(syncedConnection.updatedDate)}</span>
  );
  const created = createdDate && <span>Created {timeAgo(createdDate)}</span>;

  return (
    <div className="flex flex-col gap-0">
      <div className={cn('flex items-center gap-2 text-sm')}>
        {syncState === 'not_synced' || syncState === 'syncing' ? (
          <Badge>Syncing</Badge>
        ) : syncState === 'synced' ? (
          <Badge variant="success">Synced</Badge>
        ) : (
          <Badge variant="destructive">Sync failed</Badge>
        )}
        {lastSync}
        {lastSync && created && <span>·</span>}
        {created}
      </div>

      {syncedConnection.latestLogError && (
        <div className="mt-1 font-mono text-xs text-destructive">Error: {syncedConnection.latestLogError}</div>
      )}
    </div>
  );
};

export const SyncedConnectionLatestStatus = ({
  connectionUuid,
  teamUuid,
  createdDate,
}: {
  connectionUuid: string;
  teamUuid: string;
  createdDate?: string;
}): string | null => {
  const { syncedConnection, syncState } = useSyncedConnection(connectionUuid, teamUuid);

  if (syncState === 'synced' && syncedConnection.updatedDate) {
    return `Last synced ${timeAgo(syncedConnection.updatedDate)}`;
  }

  if (syncState === 'syncing') {
    return `Syncing`;
  }

  if (syncState === 'failed') {
    return `Sync failed`;
  }

  return null;
};
