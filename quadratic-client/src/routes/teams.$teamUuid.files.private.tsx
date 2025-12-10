import { useDebugFlags } from '@/app/debugFlags/useDebugFlags';
import { DashboardHeader } from '@/dashboard/components/DashboardHeader';
import { FileLimitBanner } from '@/dashboard/components/FileLimitBanner';
import { FilesList } from '@/dashboard/components/FilesList';
import { FilesListEmptyState } from '@/dashboard/components/FilesListEmptyState';
import { NewFileButton } from '@/dashboard/components/NewFileButton';
import { useDashboardRouteLoaderData } from '@/routes/_dashboard';
import { EmptyPage } from '@/shared/components/EmptyPage';
import { ExclamationTriangleIcon } from '@radix-ui/react-icons';
import { useRouteError } from 'react-router';

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
      userMakingRequest: { filePermissions, isFileEditRestricted },
    }) => ({
      name,
      thumbnail,
      createdDate,
      updatedDate,
      uuid,
      publicLinkAccess,
      permissions: filePermissions,
      isFileEditRestricted,
    })
  );

  return (
    <>
      <FileLimitBanner />
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
  const { debugFlags } = useDebugFlags();
  const error = useRouteError();
  if (debugFlags.getFlag('debugShowUILogs')) console.error('[<MineRoute>.<ErrorBoundary>]', error);

  return (
    <EmptyPage
      title="Unexpected error"
      description="An unexpected error occurred while retrieving your files. Try reloading the page. If the issue continues, contact us."
      Icon={ExclamationTriangleIcon}
      error={error}
    />
  );
};
