import { FilesList, FilesListUserFile } from '@/dashboard/components/FilesList';
import { apiClient } from '@/shared/api/apiClient';
import { ExclamationTriangleIcon, FileIcon } from '@radix-ui/react-icons';
import { LoaderFunctionArgs, useLoaderData, useRouteError } from 'react-router-dom';
import { debugShowUILogs } from '../app/debugFlags';
import { DashboardHeader } from '../dashboard/components/DashboardHeader';
import { Empty } from '../dashboard/components/Empty';

export const loader = async ({ request }: LoaderFunctionArgs): Promise<FilesListUserFile[]> => {
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
  const files = useLoaderData() as Awaited<ReturnType<typeof loader>>;

  return (
    <>
      <DashboardHeader title="Files shared with me" />
      <FilesList
        files={files}
        emptyState={
          <Empty
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
  const error = useRouteError();
  if (debugShowUILogs) console.error('[<MineRoute>.<ErrorBoundary>]', error);

  return (
    <div className={`mx-auto max-w-lg py-4`}>
      <Empty
        title="Unexpected error"
        description="An unexpected error occurred while retrieving your files. Try reloading the page. If the issue continues, contact us."
        Icon={ExclamationTriangleIcon}
        severity="error"
      />
    </div>
  );
};
