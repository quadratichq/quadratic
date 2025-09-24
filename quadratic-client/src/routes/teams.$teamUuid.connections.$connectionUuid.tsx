import { useDashboardRouteLoaderData } from '@/routes/_dashboard';

import type { LoaderFunctionArgs } from 'react-router';
import { useLoaderData } from 'react-router';

export const loader = async ({ params }: LoaderFunctionArgs) => {
  const { teamUuid, connectionUuid } = params;
  if (!connectionUuid || !teamUuid) throw new Error('No connection UUID provided');

  return { connectionUuid, teamUuid };
};

export const Component = () => {
  const { connectionUuid, teamUuid } = useLoaderData<typeof loader>();
  const {
    activeTeam: {
      userMakingRequest: { teamPermissions },
    },
  } = useDashboardRouteLoaderData();
  console.log(teamPermissions);

  return (
    <div>
      Connection details {teamUuid} / {connectionUuid}{' '}
    </div>
  );
};
