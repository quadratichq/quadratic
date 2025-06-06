import { editorInteractionStateTeamUuidAtom } from '@/app/atoms/editorInteractionStateAtom';
import { apiClient } from '@/shared/api/apiClient';
import { connectionClient } from '@/shared/api/connectionClient';
import type { ChatMessage } from 'quadratic-shared/typesAndSchemasAI';
import { useCallback } from 'react';
import { useRecoilValue } from 'recoil';

export function useSQLContextMessages() {
  const teamUuid = useRecoilValue(editorInteractionStateTeamUuidAtom);

  const getSQLContext = useCallback(async (): Promise<ChatMessage[]> => {
    if (!teamUuid) {
      console.log('[SQL Context] No team UUID available');
      return [];
    }

    try {
      // Get all team connections
      let connections;
      try {
        connections = await apiClient.connections.list(teamUuid);
      } catch (connectionError) {
        console.warn(
          '[SQL Context] Failed to fetch team connections, connection service may be unavailable:',
          connectionError
        );
        return [];
      }

      if (!connections || connections.length === 0) {
        console.log('[SQL Context] No database connections found');
        return [];
      }

      // Get only table names for each connection (lightweight)
      const connectionTableInfo = await Promise.all(
        connections.map(async (connection) => {
          try {
            const connectionType = connection.type.toLowerCase() as 'postgres' | 'mysql' | 'mssql' | 'snowflake';
            const schema = await connectionClient.schemas.get(connectionType, connection.uuid, teamUuid);

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

      // Filter out failed connections
      const validConnections = connectionTableInfo.filter((conn) => !conn.error);

      if (validConnections.length === 0) {
        console.log('[SQL Context] No valid database connections with table information');
        return [];
      }

      // Format as lightweight context message
      const contextText = validConnections
        .map((conn) => {
          const tablesText = conn.tableNames.length > 0 ? conn.tableNames.join(', ') : 'No tables found';

          return `Connection: ${conn.connectionName} (${conn.connectionType})\nDatabase: ${conn.database}\nTables: ${tablesText}`;
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
  }, [teamUuid]);

  return { getSQLContext };
}
