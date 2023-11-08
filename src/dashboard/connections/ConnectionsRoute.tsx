import { AddOutlined, ErrorOutline } from '@mui/icons-material';
import { Button, useTheme } from '@mui/material';
import { Link, LoaderFunctionArgs, useLoaderData, useRouteError } from 'react-router-dom';
import { apiClient } from '../../api/apiClient';
import { ApiTypes } from '../../api/types';
import { Empty } from '../../components/Empty';
import { ROUTES } from '../../constants/routes';
import { DashboardHeader } from '../components/DashboardHeader';
import { ConnectionsListComponent } from './components/ConnectionsListComponent';

export const loader = async ({ request, params }: LoaderFunctionArgs) => {
  return await apiClient.getConnections();
};

export const Component = () => {
  const connections = useLoaderData() as ApiTypes['/v0/connections.GET.response'];
  const theme = useTheme();

  return (
    <>
      <DashboardHeader
        title="Your connections"
        actions={
          <div style={{ display: 'flex', gap: theme.spacing(1) }}>
            <Button
              startIcon={<AddOutlined />}
              variant="contained"
              disableElevation
              component={Link}
              to={ROUTES.CONNECTIONS_SUPPORTED}
            >
              Add Connection
            </Button>
          </div>
        }
      ></DashboardHeader>
      <ConnectionsListComponent connections={connections} />;
    </>
  );
};

export const ErrorBoundary = () => {
  const error = useRouteError();

  // Maybe we log this to Sentry someday...
  console.error(error);
  return (
    <Empty
      title="Unexpected error"
      description="Something went wrong loading this file. If the error continues, contact us."
      Icon={ErrorOutline}
      actions={
        <Button variant="contained" disableElevation component={Link} to="/">
          Go home
        </Button>
      }
      severity="error"
    />
  );
};
