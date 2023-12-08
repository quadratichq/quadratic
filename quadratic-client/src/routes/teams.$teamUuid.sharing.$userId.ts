import { apiClient } from '@/api/apiClient';
import { ApiTypes } from 'quadratic-shared/typesAndSchemas';
import { ActionFunctionArgs } from 'react-router-dom';

export type Action = {
  'request.update-user': {
    intent: 'update-user';
    role: ApiTypes['/v0/teams/:uuid/sharing.POST.request']['role'];
  };
  'request.delete-user': {
    intent: 'delete-user';
  };
  request: Action['request.update-user'] | Action['request.delete-user'];
  response: { ok: boolean } | null;
};

export const action = async ({ request, params }: ActionFunctionArgs): Promise<Action['response']> => {
  const { teamUuid, userId } = params as { teamUuid: string; userId: string };
  const actionData = (await request.json()) as Action['request'];
  const { intent } = actionData;

  if (intent === 'update-user') {
    try {
      const { role } = actionData as Action['request.update-user'];
      await apiClient.updateUserInTeam(teamUuid, userId, { role });
      return { ok: true };
    } catch (e) {
      return { ok: false };
    }
  }

  if (intent === 'delete-user') {
    try {
      // TODO: remove
      console.log('deleting user', userId);
      await new Promise((resolve, reject) => setTimeout(reject, 3000));

      await apiClient.deleteUserInTeam(teamUuid, userId);

      // TODO: if you delete yourself (e.g. leave a team), redirect to '/'

      // Otherwise return that things completed normally
      return { ok: true };
    } catch (e) {
      return { ok: false };
    }
  }

  return null;
};
