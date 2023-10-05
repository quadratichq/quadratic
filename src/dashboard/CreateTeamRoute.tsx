import { Avatar, Box, Button, Stack, TextField, Typography, useTheme } from '@mui/material';
import { useState } from 'react';
import { Permission, PermissionSchema } from '../api/types';
import { AvatarWithLetters } from '../components/AvatarWithLetters';
import { ShareMenu, ShareMenuInviteCallback } from '../components/ShareMenu';
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

type User = {
  email: string;
  permission: Permission;
};

function EditTeam() {
  const theme = useTheme();
  const [name, setName] = useState<string>('');
  const { user } = useRootRouteLoaderData();
  // TODO currently logged in user as default
  const [users, setUsers] = useState<User[]>([
    // @ts-expect-error
    { email: user?.email, permission: PermissionSchema.enum.OWNER },
  ]);

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
            onInvite={({ email, permission }: ShareMenuInviteCallback) => {
              setUsers((prev) => [...prev, { email, permission }]);
            }}
            userEmails={users.map(({ email }: any) => email)}
          />
          {users.map((usr: any) => (
            <ShareMenu.ListItem
              key={usr.email}
              avatar={<Avatar sx={{ width: 24, height: 24 }} />}
              primary={usr.email}
              action={
                <ShareMenu.ListItemUserActions
                  value={usr.permission}
                  setValue={(newValue: any) => {
                    setUsers((prev) =>
                      prev.map((prevUsr) => {
                        if (prevUsr.email === usr.email) {
                          return { ...prevUsr, permission: newValue };
                        }
                        return prevUsr;
                      })
                    );
                  }}
                />
              }
            />
          ))}
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
