import { aiStore, failingSqlConnectionsAtom } from '@/app/ai/atoms/aiAnalystAtoms';
import { getConnectionMarkdown, getConnectionTableInfo } from '@/app/ai/utils/aiConnectionContext';
import { editorInteractionStateTeamUuidAtom } from '@/app/atoms/editorInteractionStateAtom';
import { FAILING_SQL_CONNECTIONS_EXPIRATION_TIME } from '@/shared/constants/connectionsConstant';
import { createTextContent } from 'quadratic-shared/ai/helpers/message.helper';
import type { ChatMessage, Context } from 'quadratic-shared/typesAndSchemasAI';
import type { ConnectionList } from 'quadratic-shared/typesAndSchemasConnections';
import { useRecoilCallback } from 'recoil';

export function useSqlContextMessages() {
  const getSqlContext = useRecoilCallback(
    ({ snapshot }) =>
      async ({ connections, context }: { connections: ConnectionList; context: Context }): Promise<ChatMessage[]> => {
        try {
          const teamUuid = await snapshot.getPromise(editorInteractionStateTeamUuidAtom);
          if (!teamUuid) {
            console.warn('[useSqlContextMessages] No team UUID available');
            return [];
          }

          if (!connections || connections.length === 0) {
            return [];
          }

          let failingSqlConnections = aiStore.get(failingSqlConnectionsAtom);
          const currentTime = Date.now();
          if (currentTime - failingSqlConnections.lastResetTimestamp > FAILING_SQL_CONNECTIONS_EXPIRATION_TIME) {
            failingSqlConnections = { uuids: [], lastResetTimestamp: currentTime };
            aiStore.set(failingSqlConnectionsAtom, failingSqlConnections);
          }

          let contextText = '';
          await Promise.all(
            connections
              // If there's a selected connection, only show the tables for that connection
              // Otherwise put all connections in context
              .filter((conn) => !context.connection || context.connection.id === conn.uuid)
              .map(async (connection) => {
                try {
                  // skip failing connections
                  if (failingSqlConnections.uuids.includes(connection.uuid)) {
                    return;
                  }

                  const connectionTableInfo = await getConnectionTableInfo(connection, teamUuid);
                  contextText += getConnectionMarkdown(connectionTableInfo);
                } catch (error) {
                  const prev = aiStore.get(failingSqlConnectionsAtom);
                  aiStore.set(failingSqlConnectionsAtom, {
                    ...prev,
                    uuids: [...prev.uuids.filter((uuid) => uuid !== connection.uuid), connection.uuid],
                  });

                  console.warn(
                    `[useSqlContextMessages] Failed to get table names for connection ${connection.uuid}:`,
                    error
                  );
                }
              })
          );
          if (!context.connection && !contextText) {
            return [];
          }

          return [
            {
              role: 'user',
              content: [
                createTextContent(`# Database Connections

This is the available Database Connections. This shows only table names within each connection.

Use the get_database_schemas tool to retrieve detailed column information, data types, and constraints when needed for SQL query writing.

${contextText}`),
              ],
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
          console.error('[useSqlContextMessages] Error fetching SQL context, error: ', error);
          return [];
        }
      },
    []
  );

  return { getSqlContext };
}
