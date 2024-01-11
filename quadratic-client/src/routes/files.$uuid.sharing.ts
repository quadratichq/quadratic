import { ROUTES } from '@/constants/routes';
import { ApiTypes, PublicLinkAccess } from 'quadratic-shared/typesAndSchemas';
import { ActionFunctionArgs, LoaderFunctionArgs, redirectDocument } from 'react-router-dom';
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
    | Action['request.delete-file-invite']
    | Action['request.update-file-user']
    | Action['request.delete-file-user'];
  response: { ok: boolean };
};

export const action = async ({ request, params }: ActionFunctionArgs): Promise<Action['response']> => {
  const json: Action['request'] = await request.json();
  const { uuid } = params as { uuid: string };
  const { intent } = json;

  if (intent === 'update-public-link-access') {
    try {
      const { publicLinkAccess } = json as Action['request.update-public-link-access'];
      await apiClient.files.sharing.update(uuid, { publicLinkAccess });
      return { ok: true };
    } catch (e) {
      return { ok: false };
    }
  }

  if (intent === 'create-file-invite') {
    try {
      const { email, role } = json as Action['request.create-file-invite'];
      await apiClient.files.invites.create(uuid, { email, role });
      return { ok: true };
    } catch (e) {
      return { ok: false };
    }
  }

  if (intent === 'delete-file-invite') {
    try {
      const { inviteId } = json as Action['request.delete-file-invite'];
      await apiClient.files.invites.delete(uuid, inviteId);
      return { ok: true };
    } catch (e) {
      return { ok: false };
    }
  }

  if (intent === 'update-file-user') {
    try {
      const { role, userId } = json as Action['request.update-file-user'];
      await apiClient.files.users.update(uuid, userId, { role });
      return { ok: true };
    } catch (e) {
      return { ok: false };
    }
  }

  if (intent === 'delete-file-user') {
    try {
      const { userId } = json as Action['request.delete-file-user'];
      const { redirect } = await apiClient.files.users.delete(uuid, userId);
      if (redirect) {
        return redirectDocument(ROUTES.FILES);
      }
      return { ok: true };
    } catch (e) {
      return { ok: false };
    }
  }

  console.error('Unknown action intent');
  return { ok: false };
};
