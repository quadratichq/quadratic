import { apiClient } from '@/shared/api/apiClient';
import { EmptyPage } from '@/shared/components/EmptyPage';
import { Button } from '@/shared/shadcn/ui/button';
import { setActiveTeam } from '@/shared/utils/activeTeam';
import { trackEvent } from '@/shared/utils/analyticsEvents';
import { ExclamationTriangleIcon } from '@radix-ui/react-icons';
import type { ApiTypes } from 'quadratic-shared/typesAndSchemas';
import type { ActionFunctionArgs } from 'react-router';
import { Link, Outlet, redirectDocument, useRouteError } from 'react-router';

export type TeamAction = {
  'request.update-team': ReturnType<typeof getActionUpdateTeam>;
  'request.create-team-invite': ApiTypes['/v0/teams/:uuid/invites.POST.request'] & {
    intent: 'create-team-invite';
  };
  'request.delete-team-invite': {
    intent: 'delete-team-invite';
    inviteId: string;
  };
  'request.update-team-user': ApiTypes['/v0/teams/:uuid/users/:userId.PATCH.request'] & {
    intent: 'update-team-user';
    userId: string;
  };
  'request.delete-team-user': {
    intent: 'delete-team-user';
    userId: string;
  };
  request:
    | TeamAction['request.update-team']
    | TeamAction['request.create-team-invite']
    | TeamAction['request.delete-team-invite']
    | TeamAction['request.update-team-user']
    | TeamAction['request.delete-team-user'];
  response: {
    ok: boolean;
  };
};

export function getActionUpdateTeam(body: ApiTypes['/v0/teams/:uuid.PATCH.request']) {
  return {
    ...body,
    intent: 'update-team' as const,
  };
}

export const action = async ({ request, params }: ActionFunctionArgs): Promise<TeamAction['response']> => {
  const data = (await request.json()) as TeamAction['request'];
  const { teamUuid } = params as { teamUuid: string };
  const { intent } = data;

  if (intent === 'update-team') {
    try {
      const { intent, ...rest } = data;
      await apiClient.teams.update(teamUuid, rest);
      return { ok: true };
    } catch (e) {
      return { ok: false };
    }
  }

  if (intent === 'create-team-invite') {
    trackEvent('[Team].[Users].createInvite');
    try {
      const { email, role } = data;
      await apiClient.teams.invites.create(teamUuid, { email, role });
      return { ok: true };
    } catch (e) {
      return { ok: false };
    }
  }

  if (intent === 'delete-team-invite') {
    trackEvent('[Team].[Users].deleteInvite');
    try {
      const { inviteId } = data;
      await apiClient.teams.invites.delete(teamUuid, inviteId);
      return { ok: true };
    } catch (e) {
      return { ok: false };
    }
  }

  if (intent === 'update-team-user') {
    trackEvent('[Team].[Users].updateRole');
    try {
      const { userId, role } = data;
      await apiClient.teams.users.update(teamUuid, userId, { role });
      return { ok: true };
    } catch (e) {
      return { ok: false };
    }
  }

  if (intent === 'delete-team-user') {
    trackEvent('[Team].[Users].delete');
    try {
      const { userId } = data;
      const res = await apiClient.teams.users.delete(teamUuid, userId);
      // If the user is deleting themselves, we need to clear the active team
      // and redirect to home
      if (res.redirect) {
        setActiveTeam('');
        return redirectDocument('/');
      }
      return { ok: true };
    } catch (e) {
      return { ok: false };
    }
  }

  console.error('Unknown action');
  return { ok: false };
};

export const Component = () => {
  return <Outlet />;
};

export const ErrorBoundary = () => {
  const error = useRouteError();
  console.error(error);
  return (
    <EmptyPage
      title="Unexpected error"
      description="Something went wrong loading this team. If the error continues, contact us."
      Icon={ExclamationTriangleIcon}
      actions={
        <Button asChild>
          <Link to="/">Go home</Link>
        </Button>
      }
      error={error}
    />
  );
};
