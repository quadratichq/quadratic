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
    const data = await apiClient.getFileSharing(uuid);
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
  // In the future, we'll have other updates here like updating an individual
  // user's permissions for the file
  request: Action['request.update-public-link-access'];
  response: { ok: boolean };
};

export const action = async ({ request, params }: ActionFunctionArgs): Promise<Action['response']> => {
  const json: Action['request'] = await request.json();
  const { uuid } = params as { uuid: string };
  const { intent } = json;

  if (intent === 'update-public-link-access') {
    const { publicLinkAccess } = json as Action['request.update-public-link-access'];
    try {
      await apiClient.updateFileSharing(uuid, { publicLinkAccess });
      return { ok: true };
    } catch (e) {
      return { ok: false };
    }
  }

  console.error('Unknown action intent');
  return { ok: false };
};
