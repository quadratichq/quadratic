import { Biotech, DeviceHubOutlined } from '@mui/icons-material';
import { Avatar, IconButton, List, ListItem, ListItemAvatar, ListItemText } from '@mui/material';
import { ApiTypes } from '../../../api/types';
import { DashboardHeader } from '../../components/DashboardHeader';

export const SupportedConnectionsComponent = (props: {
  connections: ApiTypes['/v0/connections/supported.GET.response'];
}) => {
  return (
    <div>
      <DashboardHeader title="Supported connections" />
      <List>
        {props.connections.map((connection, index) => {
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
