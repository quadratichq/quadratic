import { DashboardHeader } from '@/dashboard/components/DashboardHeader';
import { useDashboardRouteLoaderData } from '@/routes/_dashboard';
import { connectionClient } from '@/shared/api/connectionClient';
import { Connections } from '@/shared/components/connections/Connections';
import { ConnectionsSidebar } from '@/shared/components/connections/ConnectionsSidebar';
import { ROUTES } from '@/shared/constants/routes';
import { cn } from '@/shared/shadcn/utils';
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
      <DashboardHeader title="Team connections" />
      <div className={cn('flex w-full max-w-4xl flex-col gap-8 md:flex-row')}>
        <div className="md:w-2/3">
          <Connections
            connections={connections}
            teamUuid={teamUuid}
            staticIps={staticIps}
            sshPublicKey={sshPublicKey}
          />
        </div>
        <div className="h-[1px] w-full bg-border md:h-auto md:w-[1px]"></div>
        <div className="md:w-1/3">
          <ConnectionsSidebar staticIps={staticIps} />
        </div>
      </div>
    </>
  );
};
