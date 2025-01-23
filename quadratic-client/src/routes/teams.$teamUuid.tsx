import { Empty } from '@/dashboard/components/Empty';
import { ACTIVE_TEAM_UUID_KEY } from '@/routes/_dashboard';
import { apiClient } from '@/shared/api/apiClient';
import { Button } from '@/shared/shadcn/ui/button';
import { ExclamationTriangleIcon } from '@radix-ui/react-icons';
import mixpanel from 'mixpanel-browser';
import type { ApiTypes } from 'quadratic-shared/typesAndSchemas';
import type { ActionFunctionArgs } from 'react-router-dom';
import { Link, Outlet, redirectDocument, useRouteError } from 'react-router-dom';

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
    mixpanel.track('[Team].[Users].createInvite');
    try {
      const { email, role } = data;
      await apiClient.teams.invites.create(teamUuid, { email, role });
      return { ok: true };
    } catch (e) {
      return { ok: false };
    }
  }

  if (intent === 'delete-team-invite') {
    mixpanel.track('[Team].[Users].deleteInvite');
    try {
      const { inviteId } = data;
      await apiClient.teams.invites.delete(teamUuid, inviteId);
      return { ok: true };
    } catch (e) {
      return { ok: false };
    }
  }

  if (intent === 'update-team-user') {
    mixpanel.track('[Team].[Users].updateRole');
    try {
      const { userId, role } = data;
      await apiClient.teams.users.update(teamUuid, userId, { role });
      return { ok: true };
    } catch (e) {
      return { ok: false };
    }
  }

  if (intent === 'delete-team-user') {
    mixpanel.track('[Team].[Users].delete');
    try {
      const { userId } = data;
      const res = await apiClient.teams.users.delete(teamUuid, userId);
      // If the user is deleting themselves, we need to clear the active team
      // and redirect to home
      if (res.redirect) {
        localStorage.setItem(ACTIVE_TEAM_UUID_KEY, '');
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
  // const [searchParams, setSearchParams] = useSearchParams();
  // When the user comes back successfully from stripe, fire off an event to Google
  // useEffect(() => {
  //   if (searchParams.get('subscription') === 'created') {
  //     const transaction_id = searchParams.get('session_id');
  //     // TODO: pull the session_id from our API and get the amount from the subscription to pass to the conversion

  //     // Google Ads Conversion Tracking
  //     if (googleAnalyticsAvailable()) {
  //       // @ts-expect-error
  //       gtag('event', 'conversion', {
  //         send_to: 'AW-11007319783/44KeCMLgpJYZEOe92YAp',
  //         transaction_id,
  //       });
  //     }
  //     setSearchParams((prev) => {
  //       prev.delete('subscription');
  //       prev.delete('session_id');
  //       return prev;
  //     });
  //   }
  // }, [searchParams, setSearchParams]);

  return <Outlet />;
};

export const ErrorBoundary = () => {
  const error = useRouteError();
  console.error(error);
  // Maybe we log this to Sentry?
  return (
    <Empty
      title="Unexpected error"
      description="Something went wrong loading this team. If the error continues, contact us."
      Icon={ExclamationTriangleIcon}
      actions={
        <Button asChild>
          <Link to="/">Go home</Link>
        </Button>
      }
      severity="error"
    />
  );
};
