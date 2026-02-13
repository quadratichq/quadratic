import type { SyncState } from '@/app/atoms/useSyncedConnection';
import { SyncIcon, WarningIcon } from '@/shared/components/Icons';
import { LanguageIcon } from '@/shared/components/LanguageIcon';
import { cn } from '@/shared/shadcn/utils';
import type { ConnectionType } from 'quadratic-shared/typesAndSchemasConnections';

interface ConnectionIconProps {
  type: ConnectionType | string;
  // Should be `null` for non-synced connections.
  syncState?: SyncState | null;
  className?: string;
}

/**
 * Used for when you want to display a connection's icon _and_ it's current sync state.
 *
 * If you don't want to display the sync state, you can omit `syncState` or just
 * use the `LanguageIcon` component directly.
 */
export function ConnectionIcon({ type, syncState, className }: ConnectionIconProps) {
  if (syncState === 'not_synced' || syncState === 'syncing') {
    return <SyncIcon className={cn(className, 'animate-spin text-muted-foreground')} />;
  }

  if (syncState === 'failed') {
    return <WarningIcon className={cn(className, 'text-destructive')} />;
  }

  return <LanguageIcon language={type} className={className} />;
}
