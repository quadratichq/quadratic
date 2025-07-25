import { editorInteractionStateTeamUuidAtom } from '@/app/atoms/editorInteractionStateAtom';
import { apiClient } from '@/shared/api/apiClient';
import { connectionClient } from '@/shared/api/connectionClient';
import type { ChatMessage } from 'quadratic-shared/typesAndSchemasAI';
import { useRecoilCallback } from 'recoil';

export function useSqlContextMessages() {
  const getSqlContext = useRecoilCallback(
    ({ snapshot }) =>
      async (): Promise<ChatMessage[]> => {
        const teamUuid = await snapshot.getPromise(editorInteractionStateTeamUuidAtom);
        if (!teamUuid) {
          console.log('[SQL Context] No team UUID available');
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
            console.log('[SQL Context] No database connections found');
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
            console.log('[SQL Context] No valid database connections with table information');
            return [];
          }

          // format as lightweight context message
          const contextText = validConnections
            .map((conn) => {
              const tablesText = conn.tableNames.length > 0 ? conn.tableNames.join(', ') : 'No tables found';

              return `Connection: ${conn.connectionName} (${conn.connectionType}), id: ${conn.connectionId}\nDatabase: ${conn.database}\nTables: ${tablesText}`;
            })
            .join('\n\n');

          return [
            {
              role: 'user',
              content: [
                {
                  type: 'text',
                  text: `Available Database Connections and Tables:
${contextText}
Note: This shows only table names. Use the get_database_schemas tool to retrieve detailed column information, data types, and constraints when needed for SQL query writing.`,
                },
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
