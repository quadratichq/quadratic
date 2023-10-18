import {
  Box,
  Button,
  Divider,
  FormControl,
  FormControlLabel,
  FormHelperText,
  FormLabel,
  Radio,
  RadioGroup,
  Stack,
  TextField,
  Typography,
  useTheme,
} from '@mui/material';
import { useRef, useState } from 'react';
import AvatarEditor from 'react-avatar-editor';
import { ApiTypes } from '../../api/types';
import { AvatarWithLetters } from '../../components/AvatarWithLetters';
import { useGlobalSnackbar } from '../../components/GlobalSnackbarProvider';
import { QDialog } from '../../components/QDialog';

export function TeamEdit({ data }: { data?: ApiTypes['/v0/teams/:uuid.GET.response'] | undefined }) {
  const theme = useTheme();
  const [name, setName] = useState<string>(data ? data.team.name : '');
  const [avatarInput, setAvatarInput] = useState<File>();
  const [avatarUrl, setAvatarUrl] = useState<string>(); // TODO data.avatarUrl
  // TODO window.URL.revokeObjectURL(avatarUrl) on unmount
  const { addGlobalSnackbar } = useGlobalSnackbar();

  // const { user } = useRootRouteLoaderData();
  const toggleIconEditor = () => setAvatarInput(undefined);

  // const loggedInUser: UserShare & { access: Access[] } = {
  //   id: 1,
  //   email: user?.email as string,
  //   role: RoleSchema.enum.OWNER,
  //   access: ['TEAM_EDIT', 'TEAM_DELETE', 'TEAM_BILLING_EDIT'],
  //   name: user?.name,
  //   picture: user?.picture,
  //   hasAccount: true,
  // };

  const handleAvatarInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files ? e.target.files[0] : undefined;
    if (!file) {
      return;
    }

    const fileAsDataURL = window.URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      if (img.width > 400 && img.height > 400) {
        setAvatarInput(file);
      } else {
        addGlobalSnackbar('Image must be at least 400×400 pixels', { severity: 'error' });
      }
    };
    img.src = fileAsDataURL;
  };

  // TODO currently logged in user as default
  // const [users, setUsers] = useState<UserShare[]>(data ? data.team.users : [loggedInUser]);

  return (
    <Stack maxWidth={'30rem'} gap={theme.spacing(4)}>
      <Typography variant="body2" color="text.secondary">
        Teams are for collaborating on files with other people. Once you create a team, you can invite people to it.
      </Typography>

      {/* <EditTeamRow label="Details"> */}
      <Stack direction="row" gap={theme.spacing()} alignItems="center">
        <AvatarWithLetters size="large" src={avatarUrl ? avatarUrl : undefined}>
          {name}
        </AvatarWithLetters>
        <Box sx={{ color: 'text.secondary' }}>
          {avatarUrl ? (
            <Button
              color="inherit"
              size="small"
              onClick={() => {
                setAvatarUrl(undefined);
                setAvatarInput(undefined);
              }}
              // startIcon={<DeleteOutline fontSize="small" color="inherit" />}
            >
              Remove logo
            </Button>
          ) : (
            <Button
              size="small"
              component="label"
              color="inherit"
              // startIcon={<Add fontSize="small" color="inherit" />}
            >
              Add logo
              <input type="file" hidden accept="image/png, image/jpeg" onChange={handleAvatarInput} />
            </Button>
          )}
        </Box>
        {avatarInput && (
          <IconEditor
            onClose={toggleIconEditor}
            icon={avatarInput}
            onSave={(avatarUrl: string) => {
              console.log('setting as avatar URL', avatarUrl);
              setAvatarUrl(avatarUrl);
              setAvatarInput(undefined);
            }}
          />
        )}
      </Stack>
      <TextField
        inputProps={{ autoComplete: 'off' }}
        label="Name"
        // InputLabelProps={{ sx: { fontSize: '.875rem' } }}
        variant="outlined"
        autoFocus
        size="small"
        value={name}
        onChange={(e) => setName(e.target.value)}
      />

      {/* </EditTeamRow> */}
      {/*<EditTeamRow label="Members">
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
            loggedInUser={loggedInUser}
            onDeleteUser={(user: UserShare) => {
              setUsers((prevUsers) => prevUsers.filter((prevUser) => prevUser.email !== user.email));
            }}
            onUpdateUser={() => {}}
          />
        </ShareMenu.Wrapper>
          </EditTeamRow>*/}
      {/* <EditTeamRow label="Billing"> */}
      <FormControl>
        <FormLabel
          id="pricing"
          sx={{
            fontSize: '.8125rem',
            textIndent: theme.spacing(1),
            mb: theme.spacing(-1),
            '&.Mui-focused + div': {
              borderColor: 'transparent',
              // borderWidth: '2px',
              boxShadow: `0 0 0 2px ${theme.palette.primary.main}`,
            },
          }}
        >
          <span style={{ background: '#fff', padding: `0 ${theme.spacing(0.5)}` }}>Billing</span>
        </FormLabel>
        <RadioGroup
          name="pricing"
          defaultValue="1"
          aria-labelledby="pricing"
          sx={{
            border: `1px solid ${theme.palette.divider}`,
            borderRadius: theme.shape.borderRadius,
            '&:hover': {
              borderColor: theme.palette.action.active,
            },
          }}
        >
          <FormControlLabel
            value="1"
            control={<Radio />}
            disableTypography
            label={<PriceLabel primary="Beta trial" secondary="Free" />}
            sx={{ px: theme.spacing(1.5), py: theme.spacing(0), mr: 0 }}
          />

          <Divider />

          <FormControlLabel
            value="2"
            control={<Radio disabled />}
            disableTypography
            label={<PriceLabel disabled primary="Monthly" secondary="$--/usr/month" />}
            sx={{ px: theme.spacing(1.5), py: theme.spacing(0), mr: 0 }}
          />

          <Divider />

          <FormControlLabel
            value="3"
            control={<Radio disabled />}
            disableTypography
            label={<PriceLabel disabled primary="Yearly" secondary="$--/usr/year" />}
            sx={{ px: theme.spacing(1.5), py: theme.spacing(0), mr: 0 }}
          />
        </RadioGroup>
        <FormHelperText>[Note here about billing, beta plan termination date, free tier limits, etc.]</FormHelperText>
      </FormControl>

      {/* </EditTeamRow> */}
    </Stack>
  );
}

function PriceLabel({ primary, secondary, disabled }: any) {
  return (
    <Stack direction="row" justifyContent="space-between" flexGrow={1}>
      <Typography variant="body2" color={disabled ? 'text.disabled' : 'text.primary'}>
        {primary}
      </Typography>
      <Typography variant="body2" color={disabled ? 'text.disabled' : 'text.secondary'}>
        {secondary}
      </Typography>
    </Stack>
  );
}

// function EditTeamRow({ label, children }: any /* TODO */) {
//   const theme = useTheme();
//   return (
//     <Stack direction="row" alignItems={'flex-start'}>
//       {/* <Typography variant="body2" fontWeight={'600'} flexBasis={'16rem'} pt={theme.spacing(1.25)}>
//         {label}
//       </Typography> */}
//       <Stack gap={theme.spacing(1)} flexGrow={1}>
//         {children}
//       </Stack>
//     </Stack>
//   );
// }

function IconEditor({
  onClose,
  onSave,
  icon,
}: {
  onClose: () => void;
  onSave: Function;

  icon: File;
}) {
  const editorRef = useRef<AvatarEditor>(null);
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
            ref={editorRef}
            image={icon}
            width={200}
            height={200}
            border={30}
            borderRadius={100}
            // TODO make this black or white depending on the image...
            color={[255, 255, 255, 0.8]}
            scale={scale}
            rotate={0}
            crossOrigin="anonymous"
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
        <Button variant="outlined" size="small" onClick={onClose}>
          Cancel
        </Button>
        <Button
          variant="contained"
          disableElevation
          size="small"
          onClick={async () => {
            if (editorRef.current) {
              const dataUrl = editorRef.current.getImageScaledToCanvas().toDataURL();
              const res = await fetch(dataUrl);
              const blob = await res.blob();

              const imageUrl = window.URL.createObjectURL(blob);
              console.log(imageUrl);
              onSave(imageUrl);
            }
          }}
        >
          Save
        </Button>
      </QDialog.Actions>
    </QDialog>
  );
}
