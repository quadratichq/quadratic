import { ErrorOutline } from '@mui/icons-material';
import { Button } from '@mui/material';
import { Link, LoaderFunctionArgs, useLoaderData, useRouteError } from 'react-router-dom';
import { apiClient } from '../../api/apiClient';
import { ApiTypes } from '../../api/types';
import { Empty } from '../../components/Empty';
import { SupportedConnectionsComponent } from './components/SupportedConnectionsComponent';

export const loader = async ({ request, params }: LoaderFunctionArgs) => {
  return await apiClient.getSupportedConnections();
};

export const Component = () => {
  const connections = useLoaderData() as ApiTypes['/v0/connections/supported.GET.response'];

  return <SupportedConnectionsComponent connections={connections} />;
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
