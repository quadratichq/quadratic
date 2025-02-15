import { useDashboardRouteLoaderData } from '@/routes/_dashboard';
import { ExclamationTriangleIcon } from '@radix-ui/react-icons';
import { useRouteError } from 'react-router-dom';
import { debugShowUILogs } from '../app/debugFlags';
import { DashboardHeader } from '../dashboard/components/DashboardHeader';
import { Empty } from '../dashboard/components/Empty';
import { FilesList } from '../dashboard/components/FilesList';
import { FilesListEmptyState } from '../dashboard/components/FilesListEmptyState';
import NewFileButton from '../dashboard/components/NewFileButton';

export const Component = () => {
  const {
    activeTeam: {
      filesPrivate,
      team: { uuid: teamUuid },
    },
  } = useDashboardRouteLoaderData();

  const files = filesPrivate.map(
    ({
      file: { name, uuid, createdDate, updatedDate, publicLinkAccess, thumbnail },
      userMakingRequest: { filePermissions },
    }) => ({
      name,
      thumbnail,
      createdDate,
      updatedDate,
      uuid,
      publicLinkAccess,
      permissions: filePermissions,
    })
  );

  return (
    <>
      <DashboardHeader title="My personal files" actions={<NewFileButton isPrivate={true} />} />
      <FilesList
        files={files}
        emptyState={<FilesListEmptyState isPrivate={true} />}
        teamUuid={teamUuid}
        isPrivate={true}
      />
    </>
  );
};

export const ErrorBoundary = () => {
  const error = useRouteError();

  if (debugShowUILogs) console.error('[<MineRoute>.<ErrorBoundary>]', error);

  return (
    <div className="mx-auto max-w-prose py-4">
      <Empty
        title="Unexpected error"
        description="An unexpected error occurred while retrieving your files. Try reloading the page. If the issue continues, contact us."
        Icon={ExclamationTriangleIcon}
        severity="error"
      />
    </div>
  );
};
