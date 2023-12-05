import { ApiTypes, PublicLinkAccess } from 'quadratic-shared/typesAndSchemas';
import { ActionFunctionArgs, LoaderFunctionArgs } from 'react-router-dom';
import { apiClient } from '../api/apiClient';

type LoaderData = {
  ok: boolean;
  data?: ApiTypes['/v0/files/:uuid/sharing.GET.response'];
};

export const loader = async ({ params }: LoaderFunctionArgs): Promise<LoaderData> => {
  const { uuid } = params as { uuid: string };

  try {
    const data = await apiClient.getFileSharing(uuid);
    return { ok: true, data };
  } catch (e) {
    return { ok: false };
  }
};

type Action = {
  response: { ok: boolean } | null;
  'request.update-public-link-access': {
    action: 'update-public-link-access';
    uuid: string;
    public_link_access: PublicLinkAccess;
  };
  // In the future, we'll have other updates here like updating an individual
  // user's permissions for the file
  request: Action['request.update-public-link-access'];
};

export const action = async ({ request, params }: ActionFunctionArgs): Promise<Action['response']> => {
  const json: Action['request'] = await request.json();
  const { action, uuid } = json;

  if (action === 'update-public-link-access') {
    const { public_link_access } = json as Action['request.update-public-link-access'];
    try {
      await apiClient.updateFileSharing(uuid, { public_link_access });
      return { ok: true };
    } catch (e) {
      return { ok: false };
    }
  }

  return null;
};
