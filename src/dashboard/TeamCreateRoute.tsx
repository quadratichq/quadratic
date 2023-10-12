import { Box, Button, Stack, TextField, Typography, useTheme } from '@mui/material';
import { useState } from 'react';
import AvatarEditor from 'react-avatar-editor';
import { UserShare } from '../api/types';
import { AvatarWithLetters } from '../components/AvatarWithLetters';
import { QDialog } from '../components/QDialog';
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
  const [icon, setIcon] = useState<File>();
  const [showIconEditor, setShowIconEditor] = useState<boolean>(true);
  const { user } = useRootRouteLoaderData();
  const toggleIconEditor = () => setShowIconEditor((prev) => !prev);

  const loggedInUser: UserShare = {
    email: user?.email as string,
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
          inputProps={{ autoComplete: 'off', sx: { fontSize: '.875rem' } }}
          label="Name"
          InputLabelProps={{ sx: { fontSize: '.875rem' } }}
          variant="outlined"
          autoFocus
          size="small"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />

        {showIconEditor && <IconEditor onClose={toggleIconEditor} onSave={(icon: File) => setIcon(icon)} />}

        <Stack direction="row" gap={theme.spacing()}>
          <AvatarWithLetters
            sx={{ width: 32, height: 32, fontSize: '1rem' }}
            //src={URL.createObjectURL(icon)}
          >
            {name.length ? name : '?'}
          </AvatarWithLetters>

          <Button variant="outlined" component="label" size="small">
            Upload icon
            <input
              type="file"
              hidden
              onChange={(e) => {
                if (e.target.files && e.target.files[0]) {
                  setIcon(e.target.files[0]);
                }
              }}
            />
          </Button>
          {(icon || true) && (
            <Button onClick={toggleIconEditor} size="small">
              Edit icon
            </Button>
          )}
        </Stack>
      </EditTeamRow>
      <EditTeamRow label="Members">
        <ShareMenu.Wrapper>
          <ShareMenu.Invite
            onInvite={({ email, role }: ShareMenuInviteCallback) => {
              // @ts-expect-error
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
      <Typography variant="body2" fontWeight={'600'} flexBasis={'16rem'} pt={theme.spacing(1.25)}>
        {label}
      </Typography>
      <Stack gap={theme.spacing(2)} flexGrow={1}>
        {children}
      </Stack>
    </Stack>
  );
}

function IconEditor({ onClose, onSave }: { onClose: () => void; onSave: Function }) {
  const theme = useTheme();
  const [scaleInput, setScaleInput] = useState<number>(20);

  // 1 or 1.02 or 1.98 or 2
  const scale = 1 + Math.round(scaleInput * 10) / 1000;
  return (
    <QDialog onClose={onClose} maxWidth="xs">
      <QDialog.Title>Edit icon</QDialog.Title>
      <QDialog.Content>
        <Stack alignItems={'center'} gap={theme.spacing(1)}>
          <AvatarEditor
            image={'https://cdn.jim-nielsen.com/ios/1024/pdf-search-2023-10-12.png'}
            width={150}
            height={150}
            border={40}
            borderRadius={100}
            // TODO make this black or white depending on the image...
            color={[255, 255, 255, 0.8]}
            scale={scale}
            rotate={0}
            // style={{ backgroundColor: theme.palette.action.hover }}
          />
          <input
            type="range"
            min={0}
            max={100}
            value={scaleInput}
            onChange={(e) => {
              // TODO require at least X dimensions size, otherwise throw globalSnackbar
              setScaleInput(Number(e.target.value));
            }}
          />
        </Stack>
      </QDialog.Content>
      <QDialog.Actions>
        <Button variant="outlined" size="small">
          Cancel
        </Button>
        <Button variant="contained" disableElevation size="small">
          Save
        </Button>
      </QDialog.Actions>
    </QDialog>
  );
}
