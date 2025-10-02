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
}

export const getConnectionTableInfo = async (
  connection: ConnectionList[number],
  teamUuid: string
): Promise<ConnectionInfo> => {
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
        connectionId: connection.uuid,
        connectionName: connection.name,
        connectionType: connection.type,
        semanticDescription: connection.semanticDescription,
        schema: null,
        error: 'No schema data returned from connection service',
      };
    }

    return {
      connectionId: connection.uuid,
      connectionName: connection.name,
      connectionType: connection.type,
      semanticDescription: connection.semanticDescription,
      schema,
      error: undefined,
    };
  } catch (error) {
    console.warn(`[getConnectionTableInfo] Failed to get schema for connection ${connection.uuid}:`, error);
    return {
      connectionId: connection.uuid,
      connectionName: connection.name,
      connectionType: connection.type,
      semanticDescription: connection.semanticDescription,
      schema: null,
      error: `Failed to retrieve schema: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
};

export const getConnectionMarkdown = (connectionInfo: ConnectionInfo): string => {
  const tableNames = connectionInfo.schema?.tables?.map((table) => table.name) || [];
  const tablesText = tableNames.length > 0 ? tableNames.join(', ') : 'No tables found';
  return `
## Connection
${connectionInfo.connectionName}

### Information
type: ${connectionInfo.connectionType}
id: ${connectionInfo.connectionId}
semanticDescription: ${connectionInfo.semanticDescription}

### Database
${connectionInfo.schema?.database || 'Unknown'}

#### Tables
${tablesText}

`;
};

export const getConnectionSchemaMarkdown = (connectionInfo: ConnectionInfo): string => {
  if (connectionInfo.error) {
    return `Connection: ${connectionInfo.connectionName} (${connectionInfo.connectionType})\nID: ${connectionInfo.connectionId}\nError: ${connectionInfo.error}\n`;
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

  return `Connection: ${connectionInfo.connectionName} (${connectionInfo.connectionType})\nID: ${connectionInfo.connectionId}\nDatabase: ${connectionInfo.schema?.database || 'Unknown'}\n\n${tablesInfo}\n`;
};
