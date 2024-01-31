import { apiClient } from '@/api/apiClient';
import { FilesList } from '@/dashboard/components/FilesList';
import { ExclamationTriangleIcon, FileIcon } from '@radix-ui/react-icons';
import { ApiTypes } from 'quadratic-shared/typesAndSchemas';
import { LoaderFunctionArgs, useLoaderData, useRouteError } from 'react-router-dom';
import { Empty } from '../components/Empty';
import CreateFileButton from '../dashboard/components/CreateFileButton';
import { DashboardHeader } from '../dashboard/components/DashboardHeader';
import { debugShowUILogs } from '../debugFlags';

export type Loader = ApiTypes['/v0/files.GET.response'];

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const data = await apiClient.files.list({ shared: 'with-me' });
  return data;
};

export const Component = () => {
  const files = useLoaderData() as Loader;

  return (
    <>
      <DashboardHeader title="Files shared with me" actions={<CreateFileButton />} />
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
