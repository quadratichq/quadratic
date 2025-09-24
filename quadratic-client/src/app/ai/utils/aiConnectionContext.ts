import { connectionClient } from '@/shared/api/connectionClient';
import { GET_SCHEMA_TIMEOUT } from '@/shared/constants/connectionsConstant';
import type { ConnectionList } from 'quadratic-shared/typesAndSchemasConnections';

export interface ConnectionTableInfo {
  connectionId: string;
  connectionName: string;
  connectionType: string;
  semanticDescription: string | undefined;
  database: string;
  tableNames: string[];
}

export const getConnectionTableInfo = async (
  connection: ConnectionList[number],
  teamUuid: string
): Promise<ConnectionTableInfo> => {
  const schema = await connectionClient.schemas.get(
    connection.type,
    connection.uuid,
    teamUuid,
    false,
    GET_SCHEMA_TIMEOUT
  );
  const tableNames = schema?.tables?.map((table) => table.name) || [];
  return {
    connectionId: connection.uuid,
    connectionName: connection.name,
    connectionType: connection.type,
    semanticDescription: connection.semanticDescription,
    database: schema?.database || 'Unknown',
    tableNames: tableNames,
  };
};

export const getConnectionMarkdown = (connectionTableInfo: ConnectionTableInfo): string => {
  const tablesText =
    connectionTableInfo.tableNames.length > 0 ? connectionTableInfo.tableNames.join(', ') : 'No tables found';
  return `
## Connection
${connectionTableInfo.connectionName}

### Information
type: ${connectionTableInfo.connectionType}
id: ${connectionTableInfo.connectionId}
semanticDescription: ${connectionTableInfo.semanticDescription}

### Database
${connectionTableInfo.database}

#### Tables
${tablesText}

`;
};
