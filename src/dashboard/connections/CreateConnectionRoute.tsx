import { Biotech, DeviceHubOutlined, ErrorOutline } from '@mui/icons-material';
import { Avatar, Button, IconButton, List, ListItem, ListItemAvatar, ListItemText } from '@mui/material';
import { Link, LoaderFunctionArgs, useLoaderData, useRouteError } from 'react-router-dom';
import { apiClient } from '../../api/apiClient';
import { ApiTypes } from '../../api/types';
import { Empty } from '../../components/Empty';
import { DashboardHeader } from '../components/DashboardHeader';

export const loader = async ({ request, params }: LoaderFunctionArgs) => {
  return await apiClient.getSupportedConnections();
};

export const Component = () => {
  const connections = useLoaderData() as ApiTypes['/v0/connections/supported.GET.response'];

  return (
    <div>
      <DashboardHeader title="Supported connections" />
      <List>
        {connections.map((connection, index) => {
          return (
            <ListItem
              key={index}
              secondaryAction={
                <IconButton edge="end" aria-label="Test Connection">
                  <Biotech />
                </IconButton>
              }
            >
              <ListItemAvatar>
                <Avatar>
                  <DeviceHubOutlined />
                </Avatar>
              </ListItemAvatar>
              <ListItemText primary={connection.name} secondary={connection.description} />
            </ListItem>
          );
        })}
      </List>
    </div>
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
