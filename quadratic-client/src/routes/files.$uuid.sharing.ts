import { ApiTypes, PublicLinkAccess } from 'quadratic-shared/typesAndSchemas';
import { ActionFunctionArgs, LoaderFunctionArgs } from 'react-router-dom';
import { apiClient } from '../api/apiClient';

type Loader = {
  ok: boolean;
  data?: ApiTypes['/v0/files/:uuid/sharing.GET.response'];
};

export const loader = async ({ params }: LoaderFunctionArgs): Promise<Loader> => {
  const { uuid } = params as { uuid: string };

  try {
    const data = await apiClient.files.sharing.get(uuid);
    return { ok: true, data };
  } catch (e) {
    return { ok: false };
  }
};

export type Action = {
  'request.update-public-link-access': {
    intent: 'update-public-link-access';
    publicLinkAccess: PublicLinkAccess;
  };
  'request.create-file-invite': ApiTypes['/v0/files/:uuid/invites.POST.request'] & {
    intent: 'create-file-invite';
  };
  'request.delete-file-invite': {
    intent: 'delete-file-invite';
    inviteId: string;
  };
  'request.update-file-user': ApiTypes['/v0/files/:uuid/users/:userId.PATCH.request'] & {
    intent: 'update-file-user';
    userId: string;
  };
  'request.delete-file-user': {
    intent: 'delete-file-user';
    userId: string;
  };
  // In the future, we'll have other updates here like updating an individual
  // user's permissions for the file
  request:
    | Action['request.update-public-link-access']
    | Action['request.create-file-invite']
    | Action['request.delete-file-invite'];
  response: { ok: boolean };
};

export const action = async ({ request, params }: ActionFunctionArgs): Promise<Action['response']> => {
  const json: Action['request'] = await request.json();
  const { uuid } = params as { uuid: string };
  const { intent } = json;

  if (intent === 'update-public-link-access') {
    const { publicLinkAccess } = json as Action['request.update-public-link-access'];
    try {
      await apiClient.files.sharing.update(uuid, { publicLinkAccess });
      return { ok: true };
    } catch (e) {
      return { ok: false };
    }
  }

  if (intent === 'create-file-invite') {
    const { email, role } = json as Action['request.create-file-invite'];
    try {
      await apiClient.files.invites.create(uuid, { email, role });
      return { ok: true };
    } catch (e) {
      return { ok: false };
    }
  }

  if (intent === 'delete-file-invite') {
    const { inviteId } = json as Action['request.delete-file-invite'];
    try {
      await apiClient.files.invites.delete(uuid, inviteId);
      return { ok: true };
    } catch (e) {
      return { ok: false };
    }
  }

  if (intent === 'update-file-user') {
    const { role, userId } = json as Action['request.update-file-user'];
    try {
      await apiClient.files.users.update(uuid, userId, { role });
      return { ok: true };
    } catch (e) {
      return { ok: false };
    }
  }

  if (intent === 'delete-file-user') {
    const { userId } = json as Action['request.delete-file-user'];
    try {
      await apiClient.files.users.delete(uuid, userId);
      return { ok: true };
    } catch (e) {
      return { ok: false };
    }
  }

  console.error('Unknown action intent');
  return { ok: false };
};
