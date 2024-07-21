import { useDashboardRouteLoaderData } from '@/routes/_dashboard';
import { Box, useTheme } from '@mui/material';
import { ExclamationTriangleIcon } from '@radix-ui/react-icons';
import { useRouteError } from 'react-router-dom';
import { debugShowUILogs } from '../app/debugFlags';
import CreateFileButton from '../dashboard/components/CreateFileButton';
import { DashboardHeader } from '../dashboard/components/DashboardHeader';
import { Empty } from '../dashboard/components/Empty';
import { FilesList } from '../dashboard/components/FilesList';
import { FilesListEmptyState } from '../dashboard/components/FilesListEmptyState';

export const Component = () => {
  const {
    activeTeam: { filesPrivate },
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
      <DashboardHeader title="Private files" actions={<CreateFileButton isPrivate />} />
      <FilesList files={files} emptyState={<FilesListEmptyState isPrivate />} />
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
