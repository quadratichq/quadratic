import { aiAnalystFailingSqlConnectionsAtom } from '@/app/atoms/aiAnalystAtom';
import { editorInteractionStateTeamUuidAtom } from '@/app/atoms/editorInteractionStateAtom';
import { apiClient } from '@/shared/api/apiClient';
import { connectionClient } from '@/shared/api/connectionClient';
import { FAILING_SQL_CONNECTIONS_EXPIRATION_TIME, GET_SCHEMA_TIMEOUT } from '@/shared/constants/connectionsConstant';
import { createTextContent } from 'quadratic-shared/ai/helpers/message.helper';
import type { ChatMessage } from 'quadratic-shared/typesAndSchemasAI';
import type { ConnectionList } from 'quadratic-shared/typesAndSchemasConnections';
import { useRecoilCallback } from 'recoil';

export function useSqlContextMessages() {
  const getSqlContext = useRecoilCallback(
    ({ snapshot, set }) =>
      async (): Promise<ChatMessage[]> => {
        const teamUuid = await snapshot.getPromise(editorInteractionStateTeamUuidAtom);
        if (!teamUuid) {
          console.warn('[SQL Context] No team UUID available');
          return [];
        }

        try {
          // get all team connections
          let connections: ConnectionList;
          try {
            connections = await apiClient.connections.list(teamUuid);
          } catch (error) {
            console.warn('[SQL Context] Failed to fetch team connections, API may be unavailable:', error);
            return [];
          }

          if (!connections || connections.length === 0) {
            return [];
          }

          const failingSqlConnections = await snapshot.getPromise(aiAnalystFailingSqlConnectionsAtom);
          const currentTime = Date.now();
          if (currentTime - failingSqlConnections.lastResetTimestamp > FAILING_SQL_CONNECTIONS_EXPIRATION_TIME) {
            set(aiAnalystFailingSqlConnectionsAtom, { uuids: [], lastResetTimestamp: Date.now() });
          }

          // package team connections
          // get only table names for each connection to keep context light
          const connectionTableInfo: {
            connectionId: string;
            connectionName: string;
            connectionType: string;
            semanticDescription: string | undefined;
            database: string;
            tableNames: string[];
          }[] = [];

          await Promise.all(
            connections.map(async (connection) => {
              try {
                // skip failing connections
                if (failingSqlConnections.uuids.includes(connection.uuid)) {
                  return;
                }

                const schema = await connectionClient.schemas.get(
                  connection.type,
                  connection.uuid,
                  teamUuid,
                  false,
                  GET_SCHEMA_TIMEOUT
                );
                const tableNames = schema?.tables?.map((table) => table.name) || [];

                connectionTableInfo.push({
                  connectionId: connection.uuid,
                  connectionName: connection.name,
                  connectionType: connection.type,
                  semanticDescription: connection.semanticDescription,
                  database: schema?.database || 'Unknown',
                  tableNames: tableNames,
                });
              } catch (error) {
                set(aiAnalystFailingSqlConnectionsAtom, (prev) => ({
                  ...prev,
                  uuids: [...prev.uuids.filter((uuid) => uuid !== connection.uuid), connection.uuid],
                }));

                console.warn(`[SQL Context] Failed to get table names for connection ${connection.uuid}:`, error);
              }
            })
          );

          if (connectionTableInfo.length === 0) {
            console.warn('[SQL Context] No valid database connections with table information');
            return [];
          }

          let contextText = `# Database Connections

This is the available Database Connections. This shows only table names within each connection.

Use the get_database_schemas tool to retrieve detailed column information, data types, and constraints when needed for SQL query writing.
`;

          // format as lightweight context message
          connectionTableInfo.forEach((conn) => {
            const tablesText = conn.tableNames.length > 0 ? conn.tableNames.join(', ') : 'No tables found';

            contextText += `
## Connection
${conn.connectionName}

### Information
type: ${conn.connectionType}
id: ${conn.connectionId}
semanticDescription: ${conn.semanticDescription}

### Database
${conn.database}

#### Tables
${tablesText}

`;
          });

          return [
            {
              role: 'user',
              content: [createTextContent(contextText)],
              contextType: 'sqlSchemas',
            },
            {
              role: 'assistant',
              content: [
                createTextContent(
                  `I understand the available database connections and tables. I will use the get_database_schemas tool to retrieve detailed column information, data types, and constraints when needed for SQL query writing. How can I help you?`
                ),
              ],
              contextType: 'sqlSchemas',
            },
          ];
        } catch (error) {
          console.error('[SQL Context] Error fetching SQL context:', error);
          return [];
        }
      },
    []
  );

  return { getSqlContext };
}
