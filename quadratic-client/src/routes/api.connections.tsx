import { apiClient } from '@/shared/api/apiClient';
import { connectionClient } from '@/shared/api/connectionClient';
import { ROUTES } from '@/shared/constants/routes';
import type { ApiTypes } from 'quadratic-shared/typesAndSchemas';
import type { ConnectionType } from 'quadratic-shared/typesAndSchemasConnections';
import type { ActionFunctionArgs, LoaderFunctionArgs } from 'react-router';

/**
 *
 * Loader
 * /?team-uuid=x - list connections in a team
 * /?team-uuid=x&connection-uuid=y - get a specific connection in a team
 */
export const loader = async ({ request }: LoaderFunctionArgs) => {
  const url = new URL(request.url);
  const searchParams = new URLSearchParams(url.search);
  const teamUuid = searchParams.get('team-uuid');
  const connectionUuid = searchParams.get('connection-uuid');

  // Load connections in a team
  if (teamUuid && !connectionUuid) {
    const data = await getTeamConnections(teamUuid);
    return data;
  }

  // Load a specific team connection
  if (teamUuid && connectionUuid) {
    const data = await getConnection(teamUuid, connectionUuid);
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
async function getConnection(teamUuid: string, connectionUuid: string) {
  const connection = await apiClient.connections.get({ connectionUuid, teamUuid });
  return { ok: true, connection };
}

async function syncConnection(teamUuid: string, connectionUuid: string, type: ConnectionType) {
  const syncTypes = ['mixpanel'] as const;
  const syncType = syncTypes.find((syncType) => syncType === type.toLowerCase());

  try {
    if (syncType) {
      try {
        await connectionClient.sync.get(syncType, connectionUuid, teamUuid);
        console.log(`Successfully synced ${syncType} connection`);
      } catch (syncError) {
        console.error(`Failed to sync ${syncType} connection:`, syncError);
      }
    }

    return { ok: true };
  } catch (e) {
    console.error(e);
    return { ok: false };
  }
}

/**
 *
 * Action
 *
 */

type Action = CreateConnectionAction | UpdateConnectionAction | DeleteConnectionAction | ToggleShowConnectionDemoAction;

export const action = async ({ request, params }: ActionFunctionArgs) => {
  const data: Action = await request.json();

  if (data.action === 'create-connection') {
    const { teamUuid, body } = data as CreateConnectionAction;
    try {
      const result = await apiClient.connections.create({ teamUuid, body });

      await syncConnection(teamUuid, result.uuid, body.type);

      return { ok: true, connectionUuid: result.uuid };
    } catch (e) {
      console.error(e);
      return { ok: false };
    }
  }

  if (data.action === 'update-connection') {
    try {
      const { connectionUuid, teamUuid, body } = data as UpdateConnectionAction;

      await apiClient.connections.update({ teamUuid, connectionUuid, body });

      await syncConnection(teamUuid, connectionUuid, body.type);

      return { ok: true };
    } catch (e) {
      console.error(e);
      return { ok: false };
    }
  }

  if (data.action === 'delete-connection') {
    try {
      const { connectionUuid, teamUuid } = data as DeleteConnectionAction;
      await apiClient.connections.delete({ teamUuid, connectionUuid });
      return { ok: true };
    } catch (e) {
      console.error(e);
      return { ok: false };
    }
  }

  if (data.action === 'toggle-show-connection-demo') {
    const { teamUuid, showConnectionDemo } = data as ToggleShowConnectionDemoAction;
    await apiClient.teams.update(teamUuid, {
      settings: { showConnectionDemo },
    });
    return { ok: true };
  }

  return { ok: false };
};

export type CreateConnectionAction = ReturnType<typeof getCreateConnectionAction>['json'];
export const getCreateConnectionAction = (
  body: ApiTypes['/v0/teams/:uuid/connections.POST.request'],
  teamUuid: string
) => {
  return {
    json: {
      action: 'create-connection',
      teamUuid,
      body,
    },
    options: {
      action: ROUTES.API.CONNECTIONS.POST,
      method: 'POST',
      encType: 'application/json',
    },
  } as const;
};

export type UpdateConnectionAction = ReturnType<typeof getUpdateConnectionAction>['json'];
export const getUpdateConnectionAction = (
  connectionUuid: string,
  teamUuid: string,
  body: ApiTypes['/v0/teams/:uuid/connections/:connectionUuid.PUT.request'] & { type: ConnectionType }
) => {
  return {
    json: {
      action: 'update-connection',
      connectionUuid,
      teamUuid,
      body,
    },
    options: {
      action: ROUTES.API.CONNECTIONS.POST,
      method: 'POST',
      encType: 'application/json',
    },
  } as const;
};

export type DeleteConnectionAction = ReturnType<typeof getDeleteConnectionAction>['json'];
export const getDeleteConnectionAction = (connectionUuid: string, teamUuid: string) => {
  return {
    json: {
      action: 'delete-connection',
      connectionUuid,
      teamUuid,
    },
    options: {
      action: ROUTES.API.CONNECTIONS.POST,
      method: 'POST',
      encType: 'application/json',
    },
  } as const;
};

export type ToggleShowConnectionDemoAction = ReturnType<typeof getToggleShowConnectionDemoAction>['json'];
export const getToggleShowConnectionDemoAction = (teamUuid: string, showConnectionDemo: boolean) => {
  return {
    json: { action: 'toggle-show-connection-demo', teamUuid, showConnectionDemo },
    options: {
      action: ROUTES.API.CONNECTIONS.POST,
      method: 'POST',
      encType: 'application/json',
    },
  } as const;
};

export const Component = () => {
  return null;
};
