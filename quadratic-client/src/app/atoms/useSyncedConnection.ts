import {
  isSyncedConnectionType,
  type ConnectionType,
  type SyncedConnectionLatestLogStatus,
} from 'quadratic-shared/typesAndSchemasConnections';

/**
 * Sync state machine:
 * - not_synced: Initial state (never synced). Once in syncing/synced, never returns to this.
 * - syncing: Actively syncing (percentCompleted > 0 and < 100)
 * - synced: Synced and not actively syncing (percentCompleted >= 100, latest log not FAILED)
 * - failed: Error in latest sync (latest log status is FAILED)
 */
export type SyncState = 'not_synced' | 'syncing' | 'synced' | 'failed';

/**
 * Core sync state derivation logic.
 * Rules:
 * - not_synced: Never synced (no completed sync yet)
 * - syncing: Actively syncing (percentCompleted > 0 and < 100, or latest log is PENDING/RUNNING)
 * - synced: Completed sync, no error (percentCompleted >= 100 or latest log is COMPLETED)
 * - failed: Error in latest sync (latest log status is FAILED)
 */
export function deriveSyncState(params: {
  percentCompleted?: number;
  latestLogStatus?: SyncedConnectionLatestLogStatus | null;
}): SyncState {
  const { percentCompleted, latestLogStatus } = params;

  // If currently syncing (between 0 and 100), return syncing
  if (percentCompleted !== undefined && percentCompleted > 0 && percentCompleted < 100) {
    return 'syncing';
  }

  // Check if latest log failed - takes priority over synced state
  if (latestLogStatus === 'FAILED') {
    return 'failed';
  }

  // If latest log is PENDING or RUNNING, it's syncing
  if (latestLogStatus === 'PENDING' || latestLogStatus === 'RUNNING') {
    return 'syncing';
  }

  // If completed (100%) or latest log shows COMPLETED
  if ((percentCompleted !== undefined && percentCompleted >= 100) || latestLogStatus === 'COMPLETED') {
    return 'synced';
  }

  // Initial state - never synced
  return 'not_synced';
}

/**
 * Derives the sync state from ConnectionList data.
 * This is a convenience wrapper for components using ConnectionList items.
 */
export function deriveSyncStateFromConnectionList(connection: {
  syncedConnectionPercentCompleted?: number | null;
  syncedConnectionLatestLogStatus?: SyncedConnectionLatestLogStatus | null;
}): SyncState | undefined {
  // If there's no sync data at all, this isn't a synced connection
  if (connection.syncedConnectionPercentCompleted == null && connection.syncedConnectionLatestLogStatus == null) {
    return undefined;
  }

  return deriveSyncState({
    percentCompleted: connection.syncedConnectionPercentCompleted ?? undefined,
    latestLogStatus: connection.syncedConnectionLatestLogStatus ?? undefined,
  });
}

/**
 * Returns the sync state and whether the connection is not yet synced.
 *
 * Combines the `isSyncedConnectionType` guard with `deriveSyncStateFromConnectionList`
 * so callers don't need to repeat the same two-line pattern everywhere.
 *
 * - `syncState` is `null` for non-synced connection types, otherwise the derived `SyncState`.
 * - `isReadyForUse` is `true` when the connection is either not a synced type or is fully synced.
 */
export function getConnectionSyncInfo(connection: {
  type: ConnectionType;
  syncedConnectionPercentCompleted?: number | null;
  syncedConnectionLatestLogStatus?: SyncedConnectionLatestLogStatus | null;
}): { syncState: SyncState | null; isReadyForUse: boolean } {
  const syncState = isSyncedConnectionType(connection.type)
    ? (deriveSyncStateFromConnectionList(connection) ?? null)
    : null;
  const isReadyForUse = syncState === null || syncState === 'synced';
  return { syncState, isReadyForUse };
}
