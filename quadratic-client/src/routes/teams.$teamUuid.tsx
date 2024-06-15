import { Empty } from '@/dashboard/components/Empty';
import { apiClient } from '@/shared/api/apiClient';
import { ROUTE_LOADER_IDS } from '@/shared/constants/routes';
import { CONTACT_URL } from '@/shared/constants/urls';
import { Button } from '@/shared/shadcn/ui/button';
import { ExclamationTriangleIcon, InfoCircledIcon } from '@radix-ui/react-icons';
import { ApiTypes } from 'quadratic-shared/typesAndSchemas';
import {
  ActionFunctionArgs,
  Link,
  LoaderFunctionArgs,
  Outlet,
  isRouteErrorResponse,
  useRouteError,
  useRouteLoaderData,
} from 'react-router-dom';

export const useTeamRouteLoaderData = () => useRouteLoaderData(ROUTE_LOADER_IDS.TEAM) as LoaderData;

type LoaderData = ApiTypes['/v0/teams/:uuid.GET.response'];
export const loader = async ({ request, params }: LoaderFunctionArgs): Promise<LoaderData> => {
  const { teamUuid } = params as { teamUuid: string };
  const data = await apiClient.teams.get(teamUuid).catch((error) => {
    const { status } = error;
    if (status >= 400 && status < 500) throw new Response('4xx level error', { status });
    throw error;
  });

  // Sort the users so the logged-in user is first in the list
  data.users.sort((a, b) => {
    const loggedInUser = data.userMakingRequest.id;
    // Move the logged in user to the front
    if (a.id === loggedInUser && b.id !== loggedInUser) return -1;
    // Keep the logged in user at the front
    if (a.id !== loggedInUser && b.id === loggedInUser) return 1;
    // Leave the order as is for others
    return 0;
  });
  return data;
};

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
      const { name } = data;
      await apiClient.teams.update(teamUuid, { name });
      return { ok: true };
    } catch (e) {
      return { ok: false };
    }
  }

  if (intent === 'create-team-invite') {
    try {
      const { email, role } = data;
      await apiClient.teams.invites.create(teamUuid, { email, role });
      return { ok: true };
    } catch (e) {
      return { ok: false };
    }
  }

  if (intent === 'delete-team-invite') {
    try {
      const { inviteId } = data;
      await apiClient.teams.invites.delete(teamUuid, inviteId);
      return { ok: true };
    } catch (e) {
      return { ok: false };
    }
  }

  if (intent === 'update-team-user') {
    try {
      const { userId, role } = data;
      await apiClient.teams.users.update(teamUuid, userId, { role });
      return { ok: true };
    } catch (e) {
      return { ok: false };
    }
  }

  if (intent === 'delete-team-user') {
    try {
      const { userId } = data;
      await apiClient.teams.users.delete(teamUuid, userId);
      return { ok: true };
    } catch (e) {
      return { ok: false };
    }
  }

  console.error('Unknown action');
  return { ok: false };
};

export const Component = () => {
  // TODO: (connections) handle case where you might have Team1 active, but open
  // team2 in a new browser and now that needs to be set

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

  const actions = (
    <Button asChild variant="outline">
      <a href={CONTACT_URL} target="_blank" rel="noreferrer">
        Get help
      </a>
    </Button>
  );

  if (isRouteErrorResponse(error)) {
    if (error.status === 403)
      return (
        <Empty
          title="You don’t have access to this team"
          description="Reach out to the team owner for permission to access this team."
          Icon={InfoCircledIcon}
        />
      );
    if (error.status === 404 || error.status === 400)
      return (
        <Empty
          title="Team not found"
          description="This team may have been deleted, moved, or made unavailable. Try reaching out to the team owner."
          Icon={ExclamationTriangleIcon}
          actions={actions}
        />
      );
  }

  // Maybe we log this to Sentry someday...
  console.error(error);
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
