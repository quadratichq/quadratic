import { DashboardHeader } from '@/dashboard/components/DashboardHeader';
import { apiClient } from '@/shared/api/apiClient';
import { connectionClient } from '@/shared/api/connectionClient';
import { Connections } from '@/shared/components/connections/Connections';
import { LoaderFunctionArgs, useLoaderData } from 'react-router-dom';

export const loader = async ({ params }: LoaderFunctionArgs) => {
  const { teamUuid } = params;
  if (!teamUuid) throw new Error('No team UUID provided');

  const [connections, staticIps] = await Promise.all([
    apiClient.connections.list(teamUuid),
    connectionClient.staticIps.list(),
  ]);
  return { connections, teamUuid, staticIps };
};

export const Component = () => {
  const { connections, teamUuid, staticIps } = useLoaderData() as Awaited<ReturnType<typeof loader>>;

  return (
    <>
      <DashboardHeader title="Team connections" />
      <div className="max-w-4xl">
        <Connections connections={connections} teamUuid={teamUuid} staticIps={staticIps} />
      </div>
    </>
  );
};
