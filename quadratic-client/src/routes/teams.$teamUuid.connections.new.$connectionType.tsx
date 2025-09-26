import { ConnectionFormCreate } from '@/shared/components/connections/ConnectionForm';
import { connectionsByType } from '@/shared/components/connections/connectionsByType';
import { ArrowBackIcon } from '@/shared/components/Icons';
import { Button } from '@/shared/shadcn/ui/button';
import type { ConnectionType } from 'quadratic-shared/typesAndSchemasConnections';
import type { LoaderFunctionArgs } from 'react-router';
import { useLoaderData, useNavigate } from 'react-router';

export const loader = async ({ params }: LoaderFunctionArgs) => {
  const { teamUuid, connectionType } = params;
  if (!connectionType || !teamUuid) throw new Error('No connection UUID provided');

  // TODO: validated connectionType
  const connectionTypeValidated = connectionType.toUpperCase() as ConnectionType;
  console.log(teamUuid, connectionType);
  const Logo = connectionsByType[connectionTypeValidated].Logo;
  return { teamUuid, connectionType: connectionTypeValidated, Logo };
};

export const Component = () => {
  const { teamUuid, connectionType, Logo } = useLoaderData<typeof loader>();
  const navigate = useNavigate();

  return (
    <div className="mx-auto max-w-2xl pt-3">
      <div className="mb-4 flex items-center gap-2">
        <Button
          size="icon"
          variant="ghost"
          onClick={() => navigate(`/teams/${teamUuid}/connections/new`, { replace: true })}
        >
          <ArrowBackIcon />
        </Button>

        <div className="flex flex-grow items-center justify-center pr-9">
          {/* @ts-ignore TODO fix */}
          <Logo className="h-[40px] w-[160px]" />
        </div>
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
