import { Biotech, DeviceHubOutlined } from '@mui/icons-material';
import { Avatar, IconButton, List, ListItem, ListItemAvatar, ListItemText } from '@mui/material';
import { ApiTypes } from '../../../api/types';

export const ConnectionsListComponent = (props: { connections: ApiTypes['/v0/connections.GET.response'] }) => {
  return (
    <div>
      <List>
        {props.connections.map((connection) => {
          return (
            <ListItem
              key={connection.uuid}
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
              <ListItemText primary={connection.name} secondary={connection.type} />
            </ListItem>
          );
        })}
      </List>
    </div>
  );
};
