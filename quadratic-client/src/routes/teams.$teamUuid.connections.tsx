import { useDashboardRouteLoaderData } from '@/routes/_dashboard';
import { connectionClient } from '@/shared/api/connectionClient';
import { Connections } from '@/shared/components/connections/Connections';
import { ROUTES } from '@/shared/constants/routes';
import type { LoaderFunctionArgs } from 'react-router';
import { Navigate, useLoaderData } from 'react-router';

export const loader = async ({ params }: LoaderFunctionArgs) => {
  const { teamUuid } = params;
  if (!teamUuid) throw new Error('No team UUID provided');

  const [staticIps] = await Promise.all([connectionClient.staticIps.list()]);
  return { teamUuid, staticIps };
};

export const Component = () => {
  const { teamUuid, staticIps } = useLoaderData<typeof loader>();
  const {
    activeTeam: {
      connections,
      userMakingRequest: { teamPermissions },
      team: { sshPublicKey },
    },
  } = useDashboardRouteLoaderData();

  if (!teamPermissions?.includes('TEAM_EDIT')) {
    return <Navigate to={ROUTES.TEAM(teamUuid)} />;
  }

  return (
    <>
      <Connections connections={connections} teamUuid={teamUuid} staticIps={staticIps} sshPublicKey={sshPublicKey} />
    </>
  );
};
