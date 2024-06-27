import { apiClient } from '@/shared/api/apiClient';
import { ApiTypes } from 'quadratic-shared/typesAndSchemas';
import { ActionFunctionArgs, LoaderFunctionArgs } from 'react-router-dom';

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const url = new URL(request.url);
  const searchParams = new URLSearchParams(url.search);
  const teamUuid = searchParams.get('team-uuid');
  if (!teamUuid) {
    // TODO: (connections) log to sentry
    throw new Error('No team UUID provided');
  }

  const connections = await apiClient.connections.list(teamUuid, true);
  return connections;
};

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
export const getCreateConnectionAction = (body: ApiTypes['/v0/connections.POST.request'], teamUuid: string) => {
  return {
    action: 'create-connection',
    teamUuid,
    body,
  };
};

type UpdateConnectionAction = ReturnType<typeof getUpdateConnectionAction>;
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

// TODO: (connections) make some nice error boundary routes for the dialog
