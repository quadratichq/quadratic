import { useDebugFlags } from '@/app/debugFlags/useDebugFlags';
import { DashboardHeader } from '@/dashboard/components/DashboardHeader';
import { FilesList } from '@/dashboard/components/FilesList';
import { apiClient } from '@/shared/api/apiClient';
import { EmptyPage } from '@/shared/components/EmptyPage';
import { EmptyState } from '@/shared/components/EmptyState';
import { ExclamationTriangleIcon, FileIcon } from '@radix-ui/react-icons';
import type { LoaderFunctionArgs } from 'react-router';
import { useLoaderData, useRouteError } from 'react-router';

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const files = await apiClient.files.list({ shared: 'with-me' });
  // TODO: add these permissions one day
  const filesWithPermissions = files.map(({ name, uuid, createdDate, updatedDate, publicLinkAccess, thumbnail }) => ({
    name,
    thumbnail,
    createdDate,
    updatedDate,
    uuid,
    publicLinkAccess,
    permissions: [],
  }));
  return filesWithPermissions;
};

export const Component = () => {
  const files = useLoaderData<typeof loader>();

  return (
    <>
      <DashboardHeader title="Files shared with me" />
      <FilesList
        files={files}
        emptyState={
          <EmptyState
            title="No shared files"
            description="When someone invites you to a file, it will show up here."
            Icon={FileIcon}
          />
        }
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
