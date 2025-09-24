import { ConnectionFormCreate } from '@/shared/components/connections/ConnectionForm';
import { ArrowBackIcon } from '@/shared/components/Icons';
import { Button } from '@/shared/shadcn/ui/button';
import type { ConnectionType } from 'quadratic-shared/typesAndSchemasConnections';
import type { LoaderFunctionArgs } from 'react-router';
import { useLoaderData, useNavigate } from 'react-router';

export const loader = async ({ params }: LoaderFunctionArgs) => {
  const { teamUuid, connectionType } = params;
  if (!connectionType || !teamUuid) throw new Error('No connection UUID provided');

  // TODO: validated connectionType
  console.log(teamUuid, connectionType);
  return { teamUuid, connectionType: connectionType as ConnectionType };
};

export const Component = () => {
  const { teamUuid, connectionType } = useLoaderData<typeof loader>();
  const navigate = useNavigate();

  return (
    <div className="mx-auto max-w-2xl pt-3">
      <div className="flex items-center gap-2">
        <Button
          size="icon"
          variant="ghost"
          onClick={() => navigate(`/teams/${teamUuid}/connections/new`, { replace: true })}
        >
          <ArrowBackIcon />
        </Button>
        Connection: {connectionType}
      </div>
      <ConnectionFormCreate
        teamUuid={teamUuid}
        type={connectionType}
        handleNavigateToListView={() => navigate(`/teams/${teamUuid}/connections`, { replace: true })}
        handleNavigateToNewView={() => navigate(`/teams/${teamUuid}/connections/new`, { replace: true })}
      />
    </div>
  );
};
