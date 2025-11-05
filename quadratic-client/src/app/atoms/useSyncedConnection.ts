//! This is a Jotai atom that manages the state of the scheduled tasks menu.

import {
  editorInteractionStateShowValidationAtom,
  editorInteractionStateTeamUuidAtom,
} from '@/app/atoms/editorInteractionStateAtom';
import { apiClient } from '@/shared/api/apiClient';
import { atom, useAtom } from 'jotai';
import type { Connection, SyncedConnectionLog } from 'quadratic-shared/typesAndSchemasConnections';
import { useCallback } from 'react';
import { useRecoilState, useRecoilValue } from 'recoil';

export const CREATE_TASK_ID = 'CREATE';

export interface SyncedConnection {
  show: boolean;
  percentCompleted: number;
  logs: SyncedConnectionLog[];
}

const defaultSyncedConnection: SyncedConnection = {
  show: false,
  percentCompleted: 0,
  logs: [],
};

export const syncedConnectionAtom = atom<SyncedConnection>(defaultSyncedConnection);

interface SyncedConnectionActions {
  showSyncedConnection: () => void;
  closeSyncedConnection: () => void;
  syncedConnection: SyncedConnection;
  show: boolean;
  getConnection: () => Promise<Connection | null>;
  getLogs: () => Promise<SyncedConnectionLog[]>;
}

export const useSyncedConnection = (connectionUuid: string): SyncedConnectionActions => {
  const [syncedConnection, setSyncedConnection] = useAtom(syncedConnectionAtom);
  const [showValidation, setShowValidation] = useRecoilState(editorInteractionStateShowValidationAtom);
  const teamUuid = useRecoilValue(editorInteractionStateTeamUuidAtom);

  console.log('syncedConnection', syncedConnection);

  const showSyncedConnection = useCallback(() => {
    if (!!showValidation) {
      setShowValidation(false);
    }
    setSyncedConnection((prev) => ({ ...prev, show: true }));
  }, [showValidation, setShowValidation, setSyncedConnection]);

  const closeSyncedConnection = useCallback(() => {
    setSyncedConnection((prev) => ({ ...prev, show: false }));
  }, [setSyncedConnection]);

  const getConnection = useCallback(async () => {
    if (!connectionUuid || !teamUuid) return null;
    return apiClient.connections.get({ connectionUuid, teamUuid });
  }, [connectionUuid, teamUuid]);

  const getLogs = useCallback(
    async (pageNumber = 1, pageSize = 10) => {
      if (!connectionUuid || !teamUuid) return [];
      return apiClient.connections.getLogs({ connectionUuid, teamUuid });
    },
    [connectionUuid, teamUuid]
  );

  return {
    show: syncedConnection.show,
    showSyncedConnection,
    closeSyncedConnection,
    syncedConnection,
    getConnection,
    getLogs,
  };
};
