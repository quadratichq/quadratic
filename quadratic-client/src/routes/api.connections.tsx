import { apiClient } from '@/shared/api/apiClient';
import { connectionClient } from '@/shared/api/connectionClient';
import { ApiTypes } from 'quadratic-shared/typesAndSchemas';
import { ActionFunctionArgs, LoaderFunctionArgs } from 'react-router-dom';

/**
 *
 * Loader
 *
 */
export const loader = async ({ request }: LoaderFunctionArgs) => {
  const url = new URL(request.url);
  const searchParams = new URLSearchParams(url.search);

  // Load connections in a team
  const teamUuid = searchParams.get('team-uuid');
  if (teamUuid) {
    const data = await getTeamConnections(teamUuid);
    return data;
  }

  // Load a connection
  const connectionUuid = searchParams.get('connection-uuid');
  if (connectionUuid) {
    const data = await getConnection(connectionUuid);
    return data;
  }

  // This should never be reached. If it does, that's a developer bug
  console.error('No `team-uuid` or `connection-uuid` provided');
  return { ok: false };
};

export type GetConnections = Awaited<ReturnType<typeof getTeamConnections>>;
async function getTeamConnections(teamUuid: string) {
  const [connections, staticIps] = await Promise.all([
    apiClient.connections.list(teamUuid),
    connectionClient.staticIps.list(),
  ]);
  return { ok: true, connections, staticIps };
}

export type GetConnection = Awaited<ReturnType<typeof getConnection>>;
async function getConnection(connectionUuid: string) {
  const connection = await apiClient.connections.get(connectionUuid);
  return { ok: true, connection };
}

/**
 *
 * Action
 *
 */

type Action = CreateConnectionAction | UpdateConnectionAction | DeleteConnectionAction;

export const action = async ({ request, params }: ActionFunctionArgs) => {
  const data: Action = await request.json();

  if (data.action === 'create-connection') {
    const { teamUuid, body } = data as CreateConnectionAction;
    try {
      const result = await apiClient.connections.create(body, teamUuid);
      return { ok: true, connectionUuid: result.uuid };
    } catch (e) {
      console.error(e);
      return { ok: false };
    }
  }

  if (data.action === 'update-connection') {
    try {
      const { connectionUuid, body } = data as UpdateConnectionAction;
      await apiClient.connections.update(connectionUuid, body);
      return { ok: true };
    } catch (e) {
      console.error(e);
      return { ok: false };
    }
  }

  if (data.action === 'delete-connection') {
    try {
      const { connectionUuid } = data as DeleteConnectionAction;
      await apiClient.connections.delete(connectionUuid);
      return { ok: true };
    } catch (e) {
      console.error(e);
      return { ok: false };
    }
  }

  return { ok: false };
};

export type CreateConnectionAction = ReturnType<typeof getCreateConnectionAction>;
export const getCreateConnectionAction = (
  body: ApiTypes['/v0/team/:uuid/connections.POST.request'],
  teamUuid: string
) => {
  return {
    action: 'create-connection',
    teamUuid,
    body,
  };
};

export type UpdateConnectionAction = ReturnType<typeof getUpdateConnectionAction>;
export const getUpdateConnectionAction = (
  connectionUuid: string,
  body: ApiTypes['/v0/connections/:uuid.PUT.request']
) => {
  return {
    action: 'update-connection',
    connectionUuid,
    body,
  };
};

export type DeleteConnectionAction = ReturnType<typeof getDeleteConnectionAction>;
export const getDeleteConnectionAction = (connectionUuid: string) => {
  return {
    action: 'delete-connection',
    connectionUuid,
  };
};
