//! This is a Jotai atom that manages the state of synced connections.

import { apiClient } from '@/shared/api/apiClient';
import { atom, useAtom } from 'jotai';
import type {
  Connection,
  SyncedConnectionLatestLogStatus,
  SyncedConnectionLog,
} from 'quadratic-shared/typesAndSchemasConnections';
import { useCallback, useEffect, useMemo, useState } from 'react';

const SYNCED_CONNECTION_UPDATE_INTERVAL_MS = 10000; // 10 seconds

/**
 * Sync state machine:
 * - not_synced: Initial state (never synced). Once in syncing/synced, never returns to this.
 * - syncing: Actively syncing (percentCompleted > 0 and < 100)
 * - synced: Synced and not actively syncing (percentCompleted >= 100, latest log not FAILED)
 * - failed: Error in latest sync (latest log status is FAILED)
 */
export type SyncState = 'not_synced' | 'syncing' | 'synced' | 'failed';

export interface SyncedConnection {
  percentCompleted: number;
  updatedDate: string | null;
  latestLogStatus: SyncedConnectionLatestLogStatus | null;
  latestLogError: string | null;
  logs: SyncedConnectionLog[];
}

const defaultSyncedConnection: SyncedConnection = {
  percentCompleted: 0,
  updatedDate: null,
  latestLogStatus: null,
  latestLogError: null,
  logs: [],
};

// Store synced connection state per-connection, keyed by connectionUuid
export const syncedConnectionsAtom = atom<Record<string, SyncedConnection>>({});

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

interface SyncedConnectionActions {
  syncedConnection: SyncedConnection;
  syncState: SyncState;
  getConnection: () => Promise<Connection | null>;
  getLogs: (pageNumber?: number, pageSize?: number) => Promise<SyncedConnectionLog[]>;
  showLogs: boolean;
  setShowLogs: (showLogs: boolean) => void;
}

export const useSyncedConnection = (connectionUuid: string, teamUuid: string): SyncedConnectionActions => {
  const [syncedConnections, setSyncedConnections] = useAtom(syncedConnectionsAtom);
  const [showLogs, setShowLogs] = useState(false);

  // Get the synced connection for this specific connectionUuid, or default if not found
  const syncedConnection = useMemo(
    () => syncedConnections[connectionUuid] ?? defaultSyncedConnection,
    [syncedConnections, connectionUuid]
  );

  const getConnection = useCallback(async () => {
    if (!connectionUuid || !teamUuid) return null;

    return apiClient.connections.get({ connectionUuid, teamUuid });
  }, [connectionUuid, teamUuid]);

  const getLogs = useCallback(
    async (pageNumber = 1, pageSize = 10) => {
      if (!connectionUuid || !teamUuid || !showLogs) return [];

      return apiClient.connections.getLogs({ connectionUuid, teamUuid, pageNumber, pageSize });
    },
    [connectionUuid, teamUuid, showLogs]
  );

  useEffect(() => {
    const fetchConnection = async () => {
      const fetchedConnection = await getConnection();

      // Update only this connection's state in the map
      setSyncedConnections((prev) => ({
        ...prev,
        [connectionUuid]: {
          ...(prev[connectionUuid] ?? defaultSyncedConnection),
          percentCompleted: fetchedConnection?.syncedConnectionPercentCompleted ?? 0,
          updatedDate: fetchedConnection?.syncedConnectionUpdatedDate ?? null,
          latestLogStatus: fetchedConnection?.syncedConnectionLatestLogStatus ?? null,
          latestLogError: fetchedConnection?.syncedConnectionLatestLogError ?? null,
        },
      }));
    };

    // fire immediately to get fresh data
    fetchConnection();

    // then every SYNCED_CONNECTION_UPDATE_INTERVAL_MS
    const interval = setInterval(fetchConnection, SYNCED_CONNECTION_UPDATE_INTERVAL_MS);

    return () => clearInterval(interval);
  }, [connectionUuid, teamUuid, getConnection, setSyncedConnections]);

  // Derive the sync state from the synced connection data
  const syncState = useMemo(
    () =>
      deriveSyncState({
        percentCompleted: syncedConnection.percentCompleted,
        latestLogStatus: syncedConnection.latestLogStatus,
      }),
    [syncedConnection]
  );

  return {
    syncedConnection,
    syncState,
    getConnection,
    getLogs,
    showLogs,
    setShowLogs,
  };
};
