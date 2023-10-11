import { ErrorOutline, PeopleAltOutlined } from '@mui/icons-material';
import { Box, Button, useTheme } from '@mui/material';
import { Link, LoaderFunctionArgs, useLoaderData } from 'react-router-dom';
import { Empty } from '../components/Empty';

import { useState } from 'react';
import { UserShare } from '../api/types';
import { AccessSchema, RoleSchema } from '../permissions';
import { DashboardHeader } from './components/DashboardHeader';
import { TeamShareMenu } from './components/TeamShareMenu';

export type TeamData = {
  uuid: string;
  name: string;
  users: UserShare[];
  files: any;
};

export const loader = async ({ request, params }: LoaderFunctionArgs): Promise<TeamData> => {
  return {
    uuid: '1',
    name: 'Costco',
    users: [
      {
        email: 'jim.nielsen@quadratichq.com',
        permissions: {
          role: RoleSchema.enum.OWNER,
          access: [AccessSchema.enum.TEAM_EDIT, AccessSchema.enum.TEAM_DELETE, AccessSchema.enum.BILLING_EDIT],
        },
        name: 'Jim Nielsen',
        picture: 'https://avatars.githubusercontent.com/u/1051509?v=4',
      },
      {
        email: 'david.dimaria@quadratichq.com',
        permissions: {
          role: RoleSchema.enum.OWNER,
          access: [AccessSchema.enum.TEAM_EDIT, AccessSchema.enum.TEAM_DELETE, AccessSchema.enum.BILLING_EDIT],
        },
        name: 'David DiMaria',
        picture: 'https://avatars.githubusercontent.com/u/1051510?v=4',
      },
      {
        email: 'david.kircos@quadratichq.com',
        permissions: { role: RoleSchema.enum.EDITOR, access: [AccessSchema.enum.TEAM_EDIT] },
        name: 'David Kircos',
        picture: 'https://avatars.githubusercontent.com/u/1051508?v=4',
      },
      {
        email: 'david.figatner@quadratichq.com',
        permissions: { role: RoleSchema.enum.EDITOR, access: [AccessSchema.enum.TEAM_EDIT] },
        name: 'David Figatner',
        picture: 'https://avatars.githubusercontent.com/u/1051500?v=4',
      },
      {
        email: 'peter.mills@quadartichq.com',
        permissions: { role: RoleSchema.enum.VIEWER, access: [AccessSchema.enum.TEAM_VIEW] },
        name: '',
        picture: 'https://avatars.githubusercontent.com/u/1051500?v=4',
      },
      {
        email: 'john.doe@example.com',
        permissions: { role: RoleSchema.enum.EDITOR, access: [AccessSchema.enum.TEAM_VIEW] },
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
