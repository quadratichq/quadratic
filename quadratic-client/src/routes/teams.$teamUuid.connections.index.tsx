import { ConnectionsList } from '@/shared/components/connections/ConnectionsList';
import { LoaderFunctionArgs, useLoaderData, useParams } from 'react-router-dom';

export const loader = async ({ request, params }: LoaderFunctionArgs) => {
  const { teamUuid } = params as { teamUuid: string };
  console.log(teamUuid);

  return { connections: [] };
};

export const Component = () => {
  const { teamUuid } = useParams() as { teamUuid: string };
  const { connections } = useLoaderData() as Awaited<ReturnType<typeof loader>>;

  return (
    <ConnectionsList
      teamUuid={teamUuid}
      connections={connections.map(({ uuid, name, updatedDate, type }) => ({
        path: `/teams/${teamUuid}/connections/${uuid}`,
        name,
        updatedDate,
        type,
      }))}
    />
  );
};

/*

RESOURCE ROUTES

/api/connections - GET [{}, {}, {}]
/api/connections/create - 
/api/connections/:uuid - PUT



*/
