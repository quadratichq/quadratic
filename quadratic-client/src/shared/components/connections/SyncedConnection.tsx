import type { SyncState } from '@/app/atoms/useSyncedConnection';
import { CheckCircleIcon, ErrorIcon, SyncIcon } from '@/shared/components/Icons';
import { CONTACT_URL } from '@/shared/constants/urls';
import { Alert, AlertDescription, AlertTitle } from '@/shared/shadcn/ui/alert';
import { timeAgo } from '@/shared/utils/timeAgo';

export const SyncedConnectionStatus = ({
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
  if (syncState === 'syncing' || syncState === 'not_synced') {
    return (
      <Alert variant="warning">
        <SyncIcon className="animate-spin" />
        <AlertTitle>Syncing</AlertTitle>
        <AlertDescription>
          The data for this connection is currently syncing. This may take a few minutes. You can use your connection
          when it’s done. {createdDate && <>(Created {timeAgo(createdDate)})</>}
        </AlertDescription>
      </Alert>
    );
  }

  if (syncState === 'synced') {
    return (
      <Alert variant="success">
        <CheckCircleIcon />
        <AlertTitle>Synced</AlertTitle>
        <AlertDescription>
          This data is up to date. {updatedDate && <>(Last synced {timeAgo(updatedDate)})</>}
        </AlertDescription>
      </Alert>
    );
  }

  if (syncState === 'failed') {
    return (
      <Alert variant="destructive">
        <ErrorIcon />
        <AlertTitle>Sync failed</AlertTitle>
        <AlertDescription>
          <p>
            Check the details and try again. If you need help,{' '}
            <a href={CONTACT_URL} target="_blank" rel="noopener noreferrer" className="underline">
              contact us.
            </a>
          </p>
          {latestLogError && <p className="mt-1 font-mono text-xs">{latestLogError}</p>}
        </AlertDescription>
      </Alert>
    );
  }

  return null;
};

export const SyncedConnectionStatusMinimal = ({
  syncState,
  updatedDate,
}: {
  syncState: SyncState | null;
  updatedDate?: string | null;
}): string | null => {
  if (syncState === 'synced' && updatedDate) {
    return `Last synced ${timeAgo(updatedDate)}`;
  }

  if (syncState === 'syncing' || syncState === 'not_synced') {
    return `Syncing…`;
  }

  if (syncState === 'failed') {
    return `Sync failed`;
  }

  return null;
};
