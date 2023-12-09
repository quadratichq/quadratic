import { apiClient } from '@/api/apiClient';
import { ApiTypes } from 'quadratic-shared/typesAndSchemas';
import { ActionFunctionArgs } from 'react-router-dom';

export type Action = {
  'request.invite-user': {
    intent: 'invite-user';
    payload: ApiTypes['/v0/teams/:uuid/sharing.POST.request'];
  };
  request: Action['request.invite-user'];
  response: { ok: boolean; action?: Action['request'] } | null;
};

export const action = async ({ request, params }: ActionFunctionArgs): Promise<Action['response']> => {
  const { teamUuid } = params as { teamUuid: string };
  const actionData = (await request.json()) as Action['request'];
  const { intent } = actionData;

  if (intent === 'invite-user') {
    try {
      // TODO: remove waiting
      await new Promise((resolve, reject) => setTimeout(reject, 3000));

      const { payload } = actionData;
      await apiClient.inviteUserToTeam(teamUuid, payload);

      // TODO: why do we return the action?
      return { ok: true };
    } catch (e) {
      return { ok: false, action: actionData };
    }
  }

  return null;
};
