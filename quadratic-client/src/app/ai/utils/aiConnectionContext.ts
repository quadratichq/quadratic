import { deriveSyncStateFromConnectionList, type SyncState } from '@/app/atoms/useSyncedConnection';
import { connectionClient, type SqlSchemaResponse } from '@/shared/api/connectionClient';
import { GET_SCHEMA_TIMEOUT } from '@/shared/constants/connectionsConstant';
import { isSyncedConnectionType, type ConnectionList } from 'quadratic-shared/typesAndSchemasConnections';

export interface ConnectionInfo {
  connectionId: string;
  connectionName: string;
  connectionType: string;
  semanticDescription: string | undefined;
  schema: SqlSchemaResponse | null;
  error: string | undefined;
  isSyncedConnection: boolean;
  syncState: SyncState | null;
}

/** Demo connection UUID from CONNECTION_DEMO – not a real connection, skip schema fetch to avoid errors. */
const DEMO_CONNECTION_UUID = '00000000-0000-0000-0000-000000000000';

export const getConnectionTableInfo = async (
  connection: ConnectionList[number],
  teamUuid: string
): Promise<ConnectionInfo> => {
  const isSynced = isSyncedConnectionType(connection.type);
  const syncState = isSynced
    ? deriveSyncStateFromConnectionList({
        syncedConnectionPercentCompleted: connection.syncedConnectionPercentCompleted,
        syncedConnectionLatestLogStatus: connection.syncedConnectionLatestLogStatus,
      })
    : null;

  const connectionDetailsShared = {
    connectionId: connection.uuid,
    connectionName: connection.name,
    connectionType: connection.type,
    semanticDescription: connection.semanticDescription,
    isSyncedConnection: isSynced,
    syncState,
  };

  const isDemoConnection = connection.isDemo === true || connection.uuid === DEMO_CONNECTION_UUID;
  if (isDemoConnection) {
    return {
      ...connectionDetailsShared,
      schema: null,
      error: undefined,
    };
  }

  try {
    const schema = await connectionClient.schemas.get(
      connection.type,
      connection.uuid,
      teamUuid,
      true,
      GET_SCHEMA_TIMEOUT
    );

    if (!schema) {
      return {
        ...connectionDetailsShared,
        schema: null,
        error: 'No schema data returned from connection service',
      };
    }

    return {
      ...connectionDetailsShared,
      schema,
      error: undefined,
    };
  } catch (error) {
    // Expected for stale/invalid connections - don't log Error object to avoid Sentry capture
    console.warn(
      `[getConnectionTableInfo] Failed to get schema for connection ${connection.uuid}: ${error instanceof Error ? error.message : String(error)}`
    );
    return {
      ...connectionDetailsShared,
      schema: null,
      error: `Failed to retrieve schema: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
};

export const getConnectionMarkdown = (connectionInfo: ConnectionInfo): string => {
  const tableNames = connectionInfo.schema?.tables?.map((table) => table.name) || [];
  const tablesText = tableNames.length > 0 ? tableNames.join(', ') : 'No tables found';

  // Add sync state information for synced connections
  let syncStateText = '';
  if (connectionInfo.isSyncedConnection && connectionInfo.syncState) {
    switch (connectionInfo.syncState) {
      case 'not_synced':
        syncStateText =
          '\nsyncStatus: NOT_SYNCED (Initial sync has not started. This connection cannot be queried yet.)';
        break;
      case 'syncing':
        syncStateText =
          '\nsyncStatus: SYNCING (Data is currently being synced. This connection may have partial data or may not be queryable.)';
        break;
      case 'synced':
        syncStateText = '\nsyncStatus: SYNCED (Data sync is complete. This connection is ready to query.)';
        break;
      case 'failed':
        syncStateText =
          '\nsyncStatus: FAILED (The last sync failed. This connection may have stale or incomplete data.)';
        break;
    }
  }

  return `
## Connection
${connectionInfo.connectionName}

### Information
type: ${connectionInfo.connectionType}
id: ${connectionInfo.connectionId}
semanticDescription: ${connectionInfo.semanticDescription}${syncStateText}

### Database
${connectionInfo.schema?.database || 'Unknown'}

#### Tables
${tablesText}

`;
};

export const getConnectionSchemaMarkdown = (connectionInfo: ConnectionInfo): string => {
  // Add sync state information for synced connections
  let syncStateInfo = '';
  if (connectionInfo.isSyncedConnection && connectionInfo.syncState) {
    switch (connectionInfo.syncState) {
      case 'not_synced':
        syncStateInfo =
          'Sync Status: NOT_SYNCED (Initial sync has not started. This connection cannot be queried yet.)\n';
        break;
      case 'syncing':
        syncStateInfo =
          'Sync Status: SYNCING (Data is currently being synced. This connection may have partial data or may not be queryable.)\n';
        break;
      case 'synced':
        syncStateInfo = 'Sync Status: SYNCED (Data sync is complete. This connection is ready to query.)\n';
        break;
      case 'failed':
        syncStateInfo =
          'Sync Status: FAILED (The last sync failed. This connection may have stale or incomplete data.)\n';
        break;
    }
  }

  if (connectionInfo.error) {
    return `Connection: ${connectionInfo.connectionName} (${connectionInfo.connectionType})\nID: ${connectionInfo.connectionId}\n${syncStateInfo}Error: ${connectionInfo.error}\n`;
  }

  const tablesInfo =
    connectionInfo.schema?.tables
      ?.map((table: any) => {
        const columnsInfo =
          table.columns
            ?.map((col: any) => `  - ${col.name}: ${col.type}${col.is_nullable ? ' (nullable)' : ''}`)
            .join('\n') || '  No columns found';
        return `Table: ${table.name} (Schema: ${table.schema || 'public'})\n${columnsInfo}`;
      })
      .join('\n\n') || 'No tables found';

  return `Connection: ${connectionInfo.connectionName} (${connectionInfo.connectionType})\nID: ${connectionInfo.connectionId}\n${syncStateInfo}Database: ${connectionInfo.schema?.database || 'Unknown'}\n\n${tablesInfo}\n`;
};
