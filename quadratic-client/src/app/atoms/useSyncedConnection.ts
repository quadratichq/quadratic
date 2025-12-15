//! This is a Jotai atom that manages the state of synced connections.

import { editorInteractionStateShowLogsAtom } from '@/app/atoms/editorInteractionStateAtom';
import { apiClient } from '@/shared/api/apiClient';
import { atom, useAtom } from 'jotai';
import type { Connection, SyncedConnectionLog } from 'quadratic-shared/typesAndSchemasConnections';
import { useCallback, useEffect } from 'react';
import { useRecoilState } from 'recoil';

const SYNCED_CONNECTION_UPDATE_INTERVAL_MS = 10000; // 10 seconds

export interface SyncedConnection {
  percentCompleted: number;
  updatedDate: string | null;
  logs: SyncedConnectionLog[];
}

const defaultSyncedConnection: SyncedConnection = {
  percentCompleted: 0,
  updatedDate: null,
  logs: [],
};

export const syncedConnectionAtom = atom<SyncedConnection>(defaultSyncedConnection);

interface SyncedConnectionActions {
  syncedConnection: SyncedConnection;
  getConnection: () => Promise<Connection | null>;
  getLogs: (pageNumber?: number, pageSize?: number) => Promise<SyncedConnectionLog[]>;
  showLogs: boolean;
  setShowLogs: (showLogs: boolean) => void;
}

export const useSyncedConnection = (connectionUuid: string, teamUuid: string): SyncedConnectionActions => {
  const [syncedConnection, setSyncedConnection] = useAtom(syncedConnectionAtom);
  const [showLogs, setShowLogs] = useRecoilState(editorInteractionStateShowLogsAtom);

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

      setSyncedConnection((prev) => ({
        ...prev,
        percentCompleted: fetchedConnection?.syncedConnectionPercentCompleted ?? 0,
        updatedDate: fetchedConnection?.syncedConnectionUpdatedDate ?? null,
      }));
    };

    // fire immediately to get fresh data
    fetchConnection();

    // then every SYNCED_CONNECTION_UPDATE_INTERVAL_MS
    const interval = setInterval(fetchConnection, SYNCED_CONNECTION_UPDATE_INTERVAL_MS);

    return () => clearInterval(interval);
  }, [connectionUuid, teamUuid, getConnection, setSyncedConnection]);

  return {
    syncedConnection,
    getConnection,
    getLogs,
    showLogs,
    setShowLogs,
  };
};
