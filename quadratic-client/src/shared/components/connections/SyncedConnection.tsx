import type { SyncState } from '@/app/atoms/useSyncedConnection';
import { Badge } from '@/shared/shadcn/ui/badge';
import { cn } from '@/shared/shadcn/utils';
import { timeAgo } from '@/shared/utils/timeAgo';

export const SyncedConnection = ({
  syncState,
  updatedDate,
  latestLogError,
  createdDate,
}: {
  syncState: SyncState | undefined;
  updatedDate?: string | null;
  latestLogError?: string | null;
  createdDate?: string;
}) => {
  const lastSync = syncState === 'synced' && updatedDate && <span>Last synced {timeAgo(updatedDate)}</span>;
  const created = createdDate && <span>Created {timeAgo(createdDate)}</span>;

  return (
    <div className="flex flex-col gap-0">
      <div className={cn('flex items-center gap-2 text-sm')}>
        {syncState === 'not_synced' || syncState === 'syncing' ? (
          <Badge>Syncing</Badge>
        ) : syncState === 'synced' ? (
          <Badge variant="success">Synced</Badge>
        ) : syncState === 'failed' ? (
          <Badge variant="destructive">Sync failed</Badge>
        ) : null}
        {lastSync}
        {lastSync && created && <span>·</span>}
        {created}
      </div>

      {latestLogError && <div className="mt-1 font-mono text-xs text-destructive">Error: {latestLogError}</div>}
    </div>
  );
};

export const SyncedConnectionLatestStatus = ({
  syncState,
  updatedDate,
}: {
  syncState: SyncState | null;
  updatedDate?: string | null;
}): string | null => {
  if (syncState === 'synced' && updatedDate) {
    return `Last synced ${timeAgo(updatedDate)}`;
  }

  if (syncState === 'syncing') {
    return `Syncing`;
  }

  if (syncState === 'failed') {
    return `Sync failed`;
  }

  return null;
};
