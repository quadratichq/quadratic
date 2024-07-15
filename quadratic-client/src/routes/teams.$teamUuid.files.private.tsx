import { apiClient } from '@/shared/api/apiClient';
import { Box, useTheme } from '@mui/material';
import { ExclamationTriangleIcon } from '@radix-ui/react-icons';
import { LoaderFunctionArgs, useLoaderData, useRouteError } from 'react-router-dom';
import { debugShowUILogs } from '../app/debugFlags';
import CreateFileButton from '../dashboard/components/CreateFileButton';
import { DashboardHeader } from '../dashboard/components/DashboardHeader';
import { Empty } from '../dashboard/components/Empty';
import { FilesList } from '../dashboard/components/FilesList';
import { FilesListEmptyState } from '../dashboard/components/FilesListEmptyState';

type LoaderData = Awaited<ReturnType<typeof loader>>;

export const loader = async ({ params }: LoaderFunctionArgs) => {
  const teamUuid = params.teamUuid;
  if (!teamUuid) throw new Error('No team UUID provided');

  const data = await apiClient.teams.files.list(teamUuid, true);
  return data;
};

export const Component = () => {
  const { files } = useLoaderData() as LoaderData;

  const privateFiles = files.map(
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
      <DashboardHeader title="Private files" actions={<CreateFileButton isPrivate />} />
      <FilesList files={privateFiles} emptyState={<FilesListEmptyState isPrivate />} />
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
