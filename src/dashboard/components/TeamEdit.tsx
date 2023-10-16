import { DeleteOutline, EditOutlined } from '@mui/icons-material';
import {
  Button,
  Divider,
  FormControlLabel,
  IconButton,
  Radio,
  RadioGroup,
  Stack,
  TextField,
  Typography,
  useTheme,
} from '@mui/material';
import { useRef, useState } from 'react';
import AvatarEditor from 'react-avatar-editor';
import { ApiTypes, UserShare } from '../../api/types';
import { AvatarWithLetters } from '../../components/AvatarWithLetters';
import { useGlobalSnackbar } from '../../components/GlobalSnackbarProvider';
import { QDialog } from '../../components/QDialog';
import { ShareMenu, ShareMenuInviteCallback } from '../../components/ShareMenu';
import { AccessSchema, RoleSchema } from '../../permissions';
import { useRootRouteLoaderData } from '../../router';
import { TooltipHint } from '../../ui/components/TooltipHint';

export function TeamEdit({ data }: { data?: ApiTypes['/v0/teams/:uuid.GET.response'] | undefined }) {
  const theme = useTheme();
  const [name, setName] = useState<string>(data ? data.team.name : '');
  const [avatarInput, setAvatarInput] = useState<File>();
  const [avatarUrl, setAvatarUrl] = useState<string>(); // TODO data.avatarUrl
  // TODO window.URL.revokeObjectURL(avatarUrl) on unmount
  const { addGlobalSnackbar } = useGlobalSnackbar();

  const { user } = useRootRouteLoaderData();
  const toggleIconEditor = () => setAvatarInput(undefined);

  const loggedInUser: UserShare = {
    email: user?.email as string,
    permissions: {
      role: RoleSchema.enum.OWNER,
      access: [AccessSchema.enum.TEAM_EDIT, AccessSchema.enum.TEAM_DELETE, AccessSchema.enum.TEAM_BILLING_EDIT],
    },
    name: user?.name,
    picture: user?.picture,
  };

  const hangleAvatarInput = (e: React.ChangeEvent<HTMLInputElement>) => {
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
  const [users, setUsers] = useState<UserShare[]>(data ? data.team.users : [loggedInUser]);

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

        <Stack direction="row" gap={theme.spacing()} alignItems="center">
          <AvatarWithLetters size="large" src={avatarUrl ? avatarUrl : undefined}>
            {name}
          </AvatarWithLetters>

          <Divider orientation="vertical" flexItem sx={{ mx: theme.spacing() }} />

          <TooltipHint title="Change team avatar">
            <IconButton size="small" component="label">
              <EditOutlined fontSize="small" />
              <input type="file" hidden accept="image/png, image/jpeg" onChange={hangleAvatarInput} />
            </IconButton>
          </TooltipHint>

          <TooltipHint title="Delete team avatar">
            <IconButton
              size="small"
              onClick={() => {
                setAvatarUrl(undefined);
                setAvatarInput(undefined);
              }}
            >
              <DeleteOutline fontSize="small" />
            </IconButton>
          </TooltipHint>
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
      <EditTeamRow label="Billing">
        <RadioGroup name="pricing" defaultValue="1">
          <FormControlLabel
            value="1"
            control={<Radio />}
            disableTypography
            label={<PriceLabel primary="Beta trial" secondary="Free" />}
          />

          <Divider />

          <FormControlLabel
            value="2"
            control={<Radio />}
            disableTypography
            label={<PriceLabel primary="Monthly" secondary="$--/usr/month" />}
          />

          <Divider />

          <FormControlLabel
            value="3"
            control={<Radio />}
            disableTypography
            label={<PriceLabel primary="Yearly" secondary="$--/usr/year" />}
          />
        </RadioGroup>
      </EditTeamRow>
    </Stack>
  );
}

function PriceLabel({ primary, secondary }: any) {
  return (
    <Stack direction="row" justifyContent="space-between" flexGrow={1}>
      <Typography variant="body2">{primary}</Typography>
      <Typography variant="body2" color="text.secondary">
        {secondary}
      </Typography>
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
      <Stack gap={theme.spacing(1)} flexGrow={1}>
        {children}
      </Stack>
    </Stack>
  );
}

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
