import { ErrorOutline, PeopleAltOutlined } from '@mui/icons-material';
import { Box, Button, useTheme } from '@mui/material';
import { Link, LoaderFunctionArgs, useLoaderData } from 'react-router-dom';
import { Empty } from '../components/Empty';

import { useState } from 'react';
import { Permission, PermissionSchema } from '../api/types';
import { DashboardHeader } from './components/DashboardHeader';
import { TeamShareMenu } from './components/TeamShareMenu';

export type TeamData = {
  uuid: string;
  name: string;
  users: { email: string; permission: Permission; name?: string; picture?: string; isPending?: true }[];
  files: any;
};

export const loader = async ({ request, params }: LoaderFunctionArgs): Promise<TeamData> => {
  return {
    uuid: '1',
    name: 'Costco',
    users: [
      {
        email: 'jim.nielsen@quadratichq.com',
        permission: PermissionSchema.enum.OWNER,
        name: 'Jim Nielsen',
        picture: 'https://avatars.githubusercontent.com/u/1051509?v=4',
      },
      {
        email: 'david.kircos@quadratichq.com',
        permission: PermissionSchema.enum.EDITOR,
        name: 'David Kircos',
        picture: 'https://avatars.githubusercontent.com/u/1051508?v=4',
      },
      {
        email: 'peter.mills@quadartichq.com',
        permission: PermissionSchema.enum.VIEWER,
      },
      {
        email: 'john.doe@example.com',
        permission: PermissionSchema.enum.VIEWER,
        isPending: true,
      },
    ],
    files: [
      {
        uuid: '1234',
        name: 'My file name',
        public_link_access: 'EDIT',
        created_date: '2023-10-05T23:06:31.789Z',
        updated_date: '2023-10-05T23:06:31.789Z',
      },
    ],
  };
};

export const Component = () => {
  const theme = useTheme();
  const team = useLoaderData() as TeamData;
  const [showMembers, setShowMembers] = useState<boolean>(false);

  return (
    <>
      <DashboardHeader
        title={team.name}
        actions={
          <>
            <Button startIcon={<PeopleAltOutlined />} variant="outlined" onClick={() => setShowMembers(true)}>
              {team.users.length}
            </Button>
            <Button variant="contained" disableElevation>
              TODO Create file
            </Button>
          </>
        }
      />

      <Box sx={{ p: theme.spacing(2), textAlign: 'center' }}>Team files</Box>

      {showMembers && <TeamShareMenu onClose={() => setShowMembers(false)} team={team} />}
    </>
  );
};

export const ErrorBoundary = () => {
  // const error = useRouteError();

  return (
    <Empty
      title="Unexpected error"
      description="Something went wrong loading this team. If the error continues, contact us."
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
