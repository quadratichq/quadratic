import { Avatar, Box, Button, Stack, TextField, Typography, useTheme } from '@mui/material';
import { useState } from 'react';
import { Permission } from '../api/types';
import { UserRoleMenu } from '../components/UserRoleMenu';
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

type User = {
  email: string;
  permission: Permission;
};

function EditTeam() {
  const theme = useTheme();
  const [name, setName] = useState<string>('');
  // TODO currently logged in user as default
  const [users, setUsers] = useState<User[]>([{ email: 'jim.bob@gmail.com', permission: 'OWNER' }]);

  return (
    <Stack maxWidth={'52rem'} gap={theme.spacing(4)}>
      <EditTeamRow label="Details">
        <TextField
          label="Name"
          variant="outlined"
          autoFocus
          size="small"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />

        <Stack direction="row" gap={theme.spacing()}>
          <Avatar sx={{ width: 32, height: 32 }}>{name.length ? name[0] : '?'}</Avatar>
          <Button variant="outlined" component="label">
            Upload icon
            <input type="file" hidden />
          </Button>
        </Stack>
      </EditTeamRow>
      <EditTeamRow label="Members">
        <InviteUserInput
          onInvite={({ email, permission }: { email: string; permission: Permission }) => {
            console.log('TODO invite user', email, permission);
            setUsers((prev) => [...prev, { email, permission }]);
          }}
        />
        <Users data={users} isEditable />
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

function InviteUserInput({ onInvite }: any /* TODO */) {
  const [email, setEmail] = useState<string>('');
  const theme = useTheme();

  // TODO comma separate list someday

  return (
    <Stack
      component="form"
      direction="row"
      gap={theme.spacing()}
      onSubmit={(e) => {
        e.preventDefault();
        onInvite({ email, permission: 'OWNER' });
        setEmail('');
      }}
    >
      <Box sx={{ position: 'relative', flexGrow: 2 }}>
        <TextField
          aria-label="Email"
          placeholder="Email"
          variant="outlined"
          size="small"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          fullWidth
        />
        <Box sx={{ position: 'absolute', right: theme.spacing(0.625), top: theme.spacing(0.625) }}>
          <UserRoleMenu />
        </Box>
      </Box>
      <Button type="submit" variant="contained" disableElevation disabled={!isValidEmail(email)}>
        Invite
      </Button>
    </Stack>
  );
}

function Users({ data, isEditable }: any) {
  const theme = useTheme();

  return data.map((user: User) => (
    <Stack direction="row" alignItems="center" gap={theme.spacing(1.5)}>
      <Avatar sx={{ width: 24, height: 24 }} />
      <Stack>
        <Typography variant="body2" color="text.primary">
          {user.email} (You TODO)
        </Typography>
        <Typography variant="body2" color="text.secondary">
          {user.email}
        </Typography>
      </Stack>
      <Box sx={{ ml: 'auto' }}>
        <UserRoleMenu />
      </Box>
    </Stack>
  ));
}

// https://stackoverflow.com/a/9204568
function isValidEmail(email: string) {
  var re = /\S+@\S+\.\S+/;
  return re.test(email);
}
