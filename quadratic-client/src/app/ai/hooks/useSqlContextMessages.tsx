import { editorInteractionStateTeamUuidAtom } from '@/app/atoms/editorInteractionStateAtom';
import { apiClient } from '@/shared/api/apiClient';
import { connectionClient } from '@/shared/api/connectionClient';
import { createTextContent } from 'quadratic-shared/ai/helpers/message.helper';
import type { ChatMessage } from 'quadratic-shared/typesAndSchemasAI';
import { useRecoilCallback } from 'recoil';

export function useSqlContextMessages() {
  const getSqlContext = useRecoilCallback(
    ({ snapshot }) =>
      async (): Promise<ChatMessage[]> => {
        const teamUuid = await snapshot.getPromise(editorInteractionStateTeamUuidAtom);
        if (!teamUuid) {
          console.warn('[SQL Context] No team UUID available');
          return [];
        }

        try {
          // get all team connections
          let connections;
          try {
            connections = await apiClient.connections.list(teamUuid);
          } catch (error) {
            console.warn('[SQL Context] Failed to fetch team connections, API may be unavailable:', error);
            return [];
          }

          if (!connections || connections.length === 0) {
            return [];
          }

          // package team connections
          // get only table names for each connection to keep context light
          const connectionTableInfo = await Promise.all(
            connections.map(async (connection) => {
              try {
                const schema = await connectionClient.schemas.get(connection.type, connection.uuid, teamUuid);
                const tableNames = schema?.tables?.map((table) => table.name) || [];

                return {
                  connectionId: connection.uuid,
                  connectionName: connection.name,
                  connectionType: connection.type,
                  database: schema?.database || 'Unknown',
                  tableNames: tableNames,
                };
              } catch (error) {
                console.warn(`[SQL Context] Failed to get table names for connection ${connection.uuid}:`, error);
                return {
                  connectionId: connection.uuid,
                  connectionName: connection.name,
                  connectionType: connection.type,
                  database: 'Unknown',
                  tableNames: [],
                  error: `Failed to retrieve table names: ${error}`,
                };
              }
            })
          );

          // filter out failed connections
          const validConnections = connectionTableInfo.filter((conn) => !conn.error);

          if (validConnections.length === 0) {
            console.warn('[SQL Context] No valid database connections with table information');
            return [];
          }

          let contextText = `# Database Connections

This is the available Database Connections. This shows only table names within each connection.

Use the get_database_schemas tool to retrieve detailed column information, data types, and constraints when needed for SQL query writing.
`;

          // format as lightweight context message
          validConnections.forEach((conn) => {
            const tablesText = conn.tableNames.length > 0 ? conn.tableNames.join(', ') : 'No tables found';

            contextText += `
## Connection
${conn.connectionName}

### Information
type: ${conn.connectionType}
id: ${conn.connectionId}

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
