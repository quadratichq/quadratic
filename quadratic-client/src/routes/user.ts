import { ROUTES } from '@/constants/routes';
import { ApiTypes } from 'quadratic-shared/typesAndSchemas';
import { ActionFunctionArgs, LoaderFunctionArgs, SubmitOptions } from 'react-router-dom';
import { apiClient } from '../api/apiClient';

export const loader = async ({ request }: LoaderFunctionArgs) => {
  return apiClient.users.get();
};

type Action = {
  response: { ok: boolean } | null;
  'request.update-edu-status': {
    action: 'update-edu-status';
    eduStatus: ApiTypes['/v0/user.POST.request']['eduStatus'];
  };
  request: Action['request.update-edu-status'];
};

export const action = async ({ params, request }: ActionFunctionArgs): Promise<Action['response']> => {
  const json: Action['request'] = await request.json();
  const { action } = json;

  if (action === 'update-edu-status') {
    try {
      const { eduStatus } = json as Action['request.update-edu-status'];
      await apiClient.users.update({ eduStatus });
      return { ok: true };
    } catch (error) {
      return { ok: false };
    }
  }

  return null;
};

export function getUpdateUserAction(eduStatus: ApiTypes['/v0/user.POST.request']['eduStatus']) {
  const options: SubmitOptions = {
    method: 'POST',
    action: ROUTES.USER,
    encType: 'application/json',
  };
  const data: Action['request.update-edu-status'] = {
    action: 'update-edu-status',
    eduStatus,
  };
  return { data, options };
}
