import { Box, useTheme } from '@mui/material';
import { ExclamationTriangleIcon } from '@radix-ui/react-icons';
import { ApiTypes } from 'quadratic-shared/typesAndSchemas';
import { LoaderFunctionArgs, useLoaderData, useRouteError } from 'react-router-dom';
import { apiClient } from '../api/apiClient';
import { Empty } from '../components/Empty';
import CreateFileButton from '../dashboard/components/CreateFileButton';
import { DashboardHeader } from '../dashboard/components/DashboardHeader';
import { FilesList } from '../dashboard/components/FilesList';
import { debugShowUILogs } from '../debugFlags';

export type Loader = ApiTypes['/v0/files.GET.response'];

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const data = await apiClient.files.list();
  return data;
};

export const Component = () => {
  const files = useLoaderData() as Loader;

  return (
    <>
      <DashboardHeader title="My files" actions={<CreateFileButton />} />
      <FilesList files={files} />
    </>
  );
};

export const ErrorBoundary = () => {
  const error = useRouteError();
  const theme = useTheme();

  if (debugShowUILogs) console.error('[<MineRoute>.<ErrorBoundary>]', error);

  return (
    <Box sx={{ maxWidth: '60ch', mx: 'auto', py: theme.spacing(2) }}>
      <Empty
        title="Unexpected error"
        description="An unexpected error occurred while retrieving your files. Try reloading the page. If the issue continues, contact us."
        Icon={ExclamationTriangleIcon}
        severity="error"
      />
    </Box>
  );
};
