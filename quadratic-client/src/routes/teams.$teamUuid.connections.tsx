import { ConnectionsList } from '@/dashboard/connections/ConnectionsList';
import { DRAWER_WIDTH, useDashboardRouteLoaderData } from '@/routes/_dashboard';
import { connectionClient } from '@/shared/api/connectionClient';

import { ROUTES } from '@/shared/constants/routes';
import type { LoaderFunctionArgs } from 'react-router';
import { Navigate, Outlet, useLoaderData } from 'react-router';

export const loader = async ({ params }: LoaderFunctionArgs) => {
  const { teamUuid } = params;
  if (!teamUuid) throw new Error('No team UUID provided');

  const [staticIps] = await Promise.all([connectionClient.staticIps.list()]);
  return { teamUuid, staticIps };
};

export const Component = () => {
  const { teamUuid } = useLoaderData<typeof loader>();
  const {
    activeTeam: {
      userMakingRequest: { teamPermissions },
    },
  } = useDashboardRouteLoaderData();

  // Handles permissions for all nested routes
  if (!teamPermissions?.includes('TEAM_EDIT')) {
    return <Navigate to={ROUTES.TEAM(teamUuid)} />;
  }

  return (
    <div className={'flex h-full w-full overflow-hidden'}>
      <div style={{ width: DRAWER_WIDTH + 24 }} className="flex-none overflow-auto border-r border-border">
        <ConnectionsList />
      </div>
      <div className="w-full overflow-auto">
        <Outlet />
      </div>
    </div>
  );
};
