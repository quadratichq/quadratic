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
      console.log('[SQL Context] No team UUID found');
      return [];
    }

    try {
      // Get all team connections
      const teamConnections = await apiClient.connections.list(teamUuid);
      console.log('[SQL Context] Team connections:', teamConnections);

      if (teamConnections.length === 0) {
        console.log('[SQL Context] No team connections found');
        return [];
      }

      // Filter for SQL database connections
      const sqlConnections = teamConnections.filter((conn) =>
        ['POSTGRES', 'MYSQL', 'MSSQL', 'SNOWFLAKE'].includes(conn.type)
      );

      if (sqlConnections.length === 0) {
        console.log('[SQL Context] No SQL database connections found');
        return [];
      }

      // Collect schemas for all SQL connections
      const connectionSchemas = new Map<string, any>();

      for (const connection of sqlConnections) {
        const connectionKey = `${connection.type}-${connection.uuid}`;

        try {
          const schemaData = await connectionClient.schemas.get(
            connection.type.toLowerCase() as 'postgres' | 'mysql' | 'mssql' | 'snowflake',
            connection.uuid,
            teamUuid
          );
          if (schemaData) {
            connectionSchemas.set(connectionKey, {
              kind: connection.type,
              id: connection.uuid,
              name: connection.name,
              schema: schemaData,
            });
          }
        } catch (error) {
          console.warn(`Failed to fetch schema for connection ${connectionKey}:`, error);
        }
      }

      console.log('[SQL Context] Connection schemas collected:', connectionSchemas);

      if (connectionSchemas.size === 0) {
        console.log('[SQL Context] No connection schemas found');
        return [];
      }

      // Build context message with all SQL schemas
      const schemasArray = Array.from(connectionSchemas.values());

      return [
        {
          role: 'user',
          content: [
            {
              type: 'text',
              text: `Note: This is an internal message for context. Do not quote it in your response.\n\n
I have access to the following database connections. Here are the database schemas for reference:\n\n
${schemasArray
  .map(
    (conn, index) => `
**Database Connection ${index + 1}: ${conn.name} (${conn.kind})**
Connection ID: ${conn.id}
\`\`\`json
${JSON.stringify(conn.schema)}
\`\`\`

${conn.kind === 'POSTGRES' ? 'When generating postgres queries, put schema and table names in quotes, e.g. "schema"."TableName".' : ''}${conn.kind === 'MYSQL' ? 'When generating mysql queries, put schema and table names in backticks, e.g. `schema`.`TableName`.' : ''}${conn.kind === 'MSSQL' ? 'When generating mssql queries, put schema and table names in square brackets, e.g. [schema].[TableName].' : ''}${conn.kind === 'SNOWFLAKE' ? 'When generating Snowflake queries, put schema and table names in double quotes, e.g. "SCHEMA"."TABLE_NAME".' : ''}
`
  )
  .join('\n')}

You can create new SQL code cells using these database connections. When creating SQL code cells, use the connection ID in the language parameter like this:
{"Connection": {"kind": "${schemasArray[0]?.kind || 'POSTGRES'}", "id": "connection-uuid"}}

You can reference these database schemas when helping with SQL queries or data analysis tasks.\n`,
            },
          ],
          contextType: 'sqlSchemas',
        },
        {
          role: 'assistant',
          content: [
            {
              type: 'text',
              text: `I understand the database schemas from your available connections. I can help you write SQL queries, create new SQL code cells, and analyze data from these databases. How can I help you?`,
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
