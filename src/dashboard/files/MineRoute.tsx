import { ErrorOutline } from '@mui/icons-material';
import { Box, useTheme } from '@mui/material';
import { LoaderFunctionArgs, useLoaderData, useRouteError } from 'react-router-dom';
import { apiClient } from '../../api/apiClient';
import { Empty } from '../../components/Empty';
import { debugShowUILogs } from '../../debugFlags';
import CreateFileButton from '../components/CreateFileButton';
import { DashboardHeader } from '../components/DashboardHeader';
import { FilesList } from '../components/FilesList';

export type ListFile = Awaited<ReturnType<typeof apiClient.getFiles>>[0];
type LoaderResponse = ListFile[];

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const data: LoaderResponse = await apiClient.getFiles();
  return data;
};

export const Component = () => {
  const files = useLoaderData() as LoaderResponse;

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
        Icon={ErrorOutline}
        severity="error"
      />
    </Box>
  );
};
