import { deriveSyncStateFromConnectionList, type SyncState } from '@/app/atoms/useSyncedConnection';
import { connectionClient, type SqlSchemaResponse } from '@/shared/api/connectionClient';
import { GET_SCHEMA_TIMEOUT } from '@/shared/constants/connectionsConstant';
import type { ConnectionList } from 'quadratic-shared/typesAndSchemasConnections';

export interface ConnectionInfo {
  connectionId: string;
  connectionName: string;
  connectionType: string;
  semanticDescription: string | undefined;
  schema: SqlSchemaResponse | null;
  error: string | undefined;
  syncState: SyncState | null;
}

export const getConnectionTableInfo = async (
  connection: ConnectionList[number],
  teamUuid: string
): Promise<ConnectionInfo> => {
  const syncState =
    deriveSyncStateFromConnectionList({
      syncedConnectionPercentCompleted: connection.syncedConnectionPercentCompleted,
      syncedConnectionLatestLogStatus: connection.syncedConnectionLatestLogStatus,
    }) ?? null;

  const connectionDetailsShared = {
    connectionId: connection.uuid,
    connectionName: connection.name,
    connectionType: connection.type,
    semanticDescription: connection.semanticDescription,
    syncState,
  };

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
    console.warn(`[getConnectionTableInfo] Failed to get schema for connection ${connection.uuid}:`, error);
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
  if (connectionInfo.syncState) {
    switch (connectionInfo.syncState) {
      case 'not_synced':
      case 'syncing':
        syncStateText =
          '\nsyncStatus: SYNCING (Data is currently being synced. This connection may not be queryable yet.)';
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
  if (connectionInfo.syncState) {
    switch (connectionInfo.syncState) {
      case 'not_synced':
      case 'syncing':
        syncStateInfo =
          'Sync Status: SYNCING (Data is currently being synced. This connection may not be queryable yet.)\n';
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
