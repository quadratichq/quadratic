// @ts-nocheck
import { Box, Button, Stack, TextField, Typography, useTheme } from '@mui/material';
import { useState } from 'react';
import { UserShare } from '../api/types';
import { AvatarWithLetters } from '../components/AvatarWithLetters';
import { ShareMenu, ShareMenuInviteCallback } from '../components/ShareMenu';
import { AccessSchema, RoleSchema } from '../permissions';
import { useRootRouteLoaderData } from '../router';
import { DashboardHeader } from './components/DashboardHeader';

export const Component = () => {
  const theme = useTheme();

  return (
    <>
      <DashboardHeader title="Create team" />
      <Stack gap={theme.spacing(4)} mt={theme.spacing(4)}>
        <EditTeam />
        <Box>
          <Button variant="contained" disableElevation>
            Create team
          </Button>
        </Box>
      </Stack>
    </>
  );
};

function EditTeam() {
  const theme = useTheme();
  const [name, setName] = useState<string>('');
  const { user } = useRootRouteLoaderData();

  const loggedInUser: UserShare = {
    email: user?.email,
    permissions: {
      role: RoleSchema.enum.OWNER,
      access: [AccessSchema.enum.TEAM_EDIT, AccessSchema.enum.TEAM_DELETE, AccessSchema.enum.BILLING_EDIT],
    },
    name: user?.name,
    picture: user?.picture,
  };

  // TODO currently logged in user as default
  const [users, setUsers] = useState<UserShare[]>([loggedInUser]);

  return (
    <Stack maxWidth={'52rem'} gap={theme.spacing(4)}>
      <EditTeamRow label="Details">
        <TextField
          inputProps={{ autoComplete: 'off' }}
          label="Name"
          variant="outlined"
          autoFocus
          size="small"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />

        <Stack direction="row" gap={theme.spacing()}>
          <AvatarWithLetters sx={{ width: 32, height: 32, fontSize: '1rem' }}>
            {name.length ? name : '?'}
          </AvatarWithLetters>
          <Button variant="outlined" component="label">
            Upload icon
            <input type="file" hidden />
          </Button>
        </Stack>
      </EditTeamRow>
      <EditTeamRow label="Members">
        <ShareMenu.Wrapper>
          <ShareMenu.Invite
            onInvite={({ email, role }: ShareMenuInviteCallback) => {
              setUsers((prev) => [...prev, { email, permissions: { role, status: 'INVITED', access: [] } }]);
            }}
            userEmails={users.map(({ email }: any) => email)}
          />
          <ShareMenu.Users
            users={users}
            usersIndexForLoggedInUser={0}
            onDeleteUser={(user: UserShare) => {
              setUsers((prevUsers) => prevUsers.filter((prevUser) => prevUser.email !== user.email));
            }}
            onUpdateUser={() => {}}
          />
        </ShareMenu.Wrapper>
      </EditTeamRow>
      <EditTeamRow label="Billing">Beta</EditTeamRow>
    </Stack>
  );
}

function EditTeamRow({ label, children }: any /* TODO */) {
  const theme = useTheme();
  return (
    <Stack direction="row" alignItems={'flex-start'}>
      <Typography variant="body1" fontWeight={'600'} flexBasis={'16rem'} pt={theme.spacing(1)}>
        {label}
      </Typography>
      <Stack gap={theme.spacing(2)} flexGrow={1}>
        {children}
      </Stack>
    </Stack>
  );
}
