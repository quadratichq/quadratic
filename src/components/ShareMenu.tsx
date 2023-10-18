import { ArrowDropDown, Check, EmailOutlined, Public, PublicOff } from '@mui/icons-material';
import {
  Alert,
  Avatar,
  Box,
  Button,
  ButtonBase,
  Divider,
  ListItemIcon,
  ListItemText,
  Menu,
  MenuItem,
  Skeleton,
  Stack,
  TextField,
  Typography,
  useTheme,
} from '@mui/material';
import React, { useEffect, useState } from 'react';
import { useFetcher } from 'react-router-dom';
import { z } from 'zod';
import { PublicLinkAccess, UserShare } from '../api/types';
import { Access, Role, RoleSchema } from '../permissions';
import { AvatarWithLetters } from './AvatarWithLetters';
import { getUserShareOptions } from './ShareMenu.utils';

/**
 * <ShareMenu> usage:
 *
 * <ShareMenu.Wrapper>
 *   <ShareMenu.Invite>
 *   <ShareMenu.Users>
 */
ShareMenu.Wrapper = Wrapper;
ShareMenu.Invite = Invite;
ShareMenu.Users = Users;

function Wrapper({ children }: { children: React.ReactNode }) {
  const theme = useTheme();
  return (
    <Stack gap={theme.spacing(1)} direction="column">
      {children}
    </Stack>
  );
}

function Loading() {
  return (
    <>
      <Skeleton variant="circular" animation="pulse" width={24} height={24} />
      <Skeleton width={160} />
      <Skeleton width={120} />
    </>
  );
}

function ShareMenu({ fetcherUrl, uuid }: { fetcherUrl: string; uuid: string }) {
  const theme = useTheme();
  const fetcher = useFetcher();
  const [users, setUsers] = useState<UserShare[]>([]);
  const isLoading = Boolean(!fetcher.data?.ok);
  // const owner = fetcher.data?.data?.owner;
  const publicLinkAccess = fetcher.data?.data?.public_link_access;
  // const isShared = publicLinkAccess && publicLinkAccess !== 'NOT_SHARED';
  // const isDisabledCopyShareLink = showSkeletons ? true : !isShared;
  const showLoadingError = fetcher.state === 'idle' && fetcher.data && !fetcher.data.ok;
  // const isFile = fetcherUrl.includes('/files/');
  const canEdit = true; // TODO fetcher.data.permission.access.includes('FILE_EDIT');;

  // On the initial mount, load the data (if it's not there already)
  useEffect(() => {
    if (fetcher.state === 'idle' && !fetcher.data) {
      fetcher.load(fetcherUrl);
    }
  }, [fetcher, fetcherUrl]);

  return (
    <ShareMenu.Wrapper>
      {showLoadingError && (
        <Alert
          severity="error"
          action={
            <Button
              color="inherit"
              size="small"
              onClick={() => {
                fetcher.load(fetcherUrl);
              }}
            >
              Reload
            </Button>
          }
          sx={{
            // Align the alert so it's icon/button match each row item
            px: theme.spacing(3),
            mx: theme.spacing(-3),
          }}
        >
          Failed to retrieve sharing info. Try reloading.
        </Alert>
      )}

      {canEdit && (
        <ShareMenu.Invite
          onInvite={({ email, role }) => {
            setUsers((prev: any) => [...prev, { email, role }]);
          }}
          userEmails={users.map(({ email }) => email)}
        />
      )}

      {isLoading ? (
        <>
          <Row>
            <Loading />
          </Row>
          <Row>
            <Loading />
          </Row>
        </>
      ) : (
        <>
          {canEdit && (
            <>
              <Row>
                <PublicLink fetcherUrl={fetcherUrl} publicLinkAccess={publicLinkAccess} uuid={uuid} />
              </Row>
              {/* TODO <Row>Team</Row> */}
            </>
          )}
          {/* <UserListItem users={users} user={owner} isOwner={isOwner} /> */}
        </>
      )}
    </ShareMenu.Wrapper>
  );
}

function Users({
  users,
  loggedInUser,
  onUpdateUser,
  onDeleteUser,
}: {
  users: UserShare[];
  loggedInUser: { id: number; role: Role; access: Access[] };
  onUpdateUser: (user: UserShare) => void;
  onDeleteUser: (user: UserShare) => void;
}) {
  // const { user } = useRootRouteLoaderData();

  // TODO if this isn't found (should be an error)

  return (
    <>
      {users.map((user, i) => (
        <UserListItem
          key={user.email}
          users={users}
          loggedInUser={loggedInUser}
          usersIndexForRenderedUser={i}
          onUpdateUser={onUpdateUser}
          onDeleteUser={onDeleteUser}
        />
      ))}
    </>
  );
}

function UserListItem({
  users,
  loggedInUser,
  usersIndexForRenderedUser,
  onUpdateUser,
  onDeleteUser,
}: {
  users: UserShare[];
  loggedInUser: { id: number; role: Role; access: Access[] };
  usersIndexForRenderedUser: number;
  onUpdateUser: (user: UserShare) => void;
  onDeleteUser: (user: UserShare) => void;
}) {
  const user = users[usersIndexForRenderedUser];

  // TODO figure out primary vs. secondary display & "resend"
  const primary = user.name ? user.name : user.email;
  const theme = useTheme();

  const isPending = false; // TODO user.permissions.status === 'INVITE_SENT';

  let secondary = user.hasAccount ? (
    user.email
  ) : (
    <Stack direction="row" gap={theme.spacing(0.5)}>
      Invite sent.{' '}
      <ButtonBase sx={{ textDecoration: 'underline', fontSize: 'inherit', fontFamily: 'inherit' }}>Resend</ButtonBase>
    </Stack>
  );

  let labels = getUserShareOptions({
    user,
    loggedInUser,
    users,
    canHaveMoreThanOneOwner: true, // TODO teams? yes. files? no.
  });
  let options: Option[] = [];
  labels.forEach((label) => {
    if (label === 'Owner') {
      options.push({
        label,
        onClick: () => onUpdateUser({ ...user, role: RoleSchema.enum.OWNER }),
      });
    }
    if (label === 'Can edit') {
      options.push({
        label,
        onClick: () => onUpdateUser({ ...user, role: RoleSchema.enum.EDITOR }),
      });
    }
    if (label === 'Can view') {
      options.push({
        label,
        onClick: () => onUpdateUser({ ...user, role: RoleSchema.enum.VIEWER }),
      });
    }
    if (label === 'Leave' || label === 'Remove') {
      options.push(
        { divider: true },
        {
          label,
          onClick: () => {
            onDeleteUser(user);
            // TODO if 'leave' then redirect user to dashboard
          },
        }
      );
    }
  });

  const label = user.role === 'OWNER' ? 'Owner' : user.role === 'EDITOR' ? 'Can edit' : 'Can view';

  return (
    <Row>
      {isPending ? (
        <Avatar sx={{ width: 24, height: 24, fontSize: '1rem' }}>
          <EmailOutlined fontSize="inherit" />
        </Avatar>
      ) : (
        <AvatarWithLetters src={user.picture} size="small">
          {user.name ? user.name : user.email}
        </AvatarWithLetters>
      )}
      <Stack>
        <Typography variant="body2" color="text.primary">
          {primary} {loggedInUser.id === user.id && ' (You)'}
        </Typography>
        {secondary && (
          <Typography variant="caption" color="text.secondary">
            {secondary}
          </Typography>
        )}
      </Stack>
      <Box sx={{ ml: 'auto' }}>
        <UserPopoverMenu label={label} options={options} />
      </Box>
    </Row>
  );
}

/* =============================================================================
   UserPopoverMenu
   ========================================================================== */

type OptionItem = {
  label: string;
  onClick: Function;
  disabled?: boolean;
};
type OptionDivider = {
  divider: boolean;
};
type Option = OptionItem | OptionDivider;
function isDividerOption(option: Option): option is OptionDivider {
  return 'divider' in option;
}
export function UserPopoverMenu({ options, label }: { options: Option[]; label: string }) {
  const [anchorEl, setAnchorEl] = React.useState<null | HTMLElement>(null);
  const open = Boolean(anchorEl);

  const handleOpen = (event: React.MouseEvent<HTMLElement>) => {
    setAnchorEl(event.currentTarget);
  };

  const handleClose = () => {
    setAnchorEl(null);
  };

  // If there's only one option, don't make it a clickable menu
  if (options.length < 2) {
    return (
      <Typography
        variant="button"
        sx={{
          // Hack to get these to look like "small" button
          fontSize: '0.8125rem',
          textTransform: 'inherit',
        }}
      >
        {label}
      </Typography>
    );
  }

  return (
    <div>
      <Button
        id="user-options-button"
        aria-controls={open ? 'user-options-menu' : undefined}
        aria-haspopup="true"
        aria-expanded={open ? 'true' : undefined}
        onClick={handleOpen}
        color="inherit"
        // disabled={disabled}
        size="small"
        endIcon={<ArrowDropDown />}
        // sx={{ '&:hover': { backgroundColor: 'transparent' } }}
      >
        {label}
      </Button>
      <Menu
        id="user-options-menu"
        aria-labelledby="user-options-button"
        anchorEl={anchorEl}
        open={open}
        onClose={handleClose}
        anchorOrigin={{
          vertical: 'top',
          horizontal: 'left',
        }}
        transformOrigin={{
          vertical: 'top',
          horizontal: 'left',
        }}
        transitionDuration={100}
      >
        {options.map((option, key) => {
          if (isDividerOption(option)) {
            return <Divider key={key} />;
          }

          const selected = option.label === label;
          return (
            <MenuItem
              key={key}
              onClick={() => {
                handleClose();
                if (option.onClick) option.onClick(); // TODO get the types better here
              }}
              dense
              disabled={option.disabled}
              selected={selected}
            >
              {selected && (
                <ListItemIcon>
                  <Check />
                </ListItemIcon>
              )}
              <ListItemText inset={!selected} disableTypography>
                <Typography variant="body2">{option.label}</Typography>
              </ListItemText>
            </MenuItem>
          );
        })}
      </Menu>
    </div>
  );
}

/*
function InviteOptions({ includeOwner, includeEditor, includeViewer, includeRemove, value, setValue }: { includeOwner:boolean, includeEditor: boolean, includeViewer: boolean; includeRemove: boolean; }) {
  let options = [];
  if (includeOwner) {
    options.push({ label: 'Owner', value: PermissionSchema.enum.OWNER });
  }
  if (includeEditor) {}
  return <ShareFileMenuPopover></ShareFileMenuPopover>
}


AddUserOptions: file & team
  userPermission: isOwner -  Can edit, Can view
  userPermission: isEditor - Can edit, Can view
  userPermission: isViewer - Can view

UpdateUserOptions: file & team
  userPermission: isOwner - Owner??, Can edit, Can view, Remove, Resend
  userPermission: isEditor - Can edit, Can view, Remove, Resend
  userPermission: isViewer - Can view

<ShareItem.Wrapper>
  <ShareItem.AddUser>
  <ShareItem.FilePublicLink>
  <ShareItem.Team>
  <ShareItem.User user={User}>

<ShareMenu.Invite>
  <ShareMenu.InviteOptionEditor onClick={}>
  <ShareMenu.InviteOptionEditor>
*/

export type ShareMenuInviteCallback = { email: string; role: string /* TODO */ };
function Invite({
  onInvite,
  disabled,
  userEmails,
}: {
  onInvite: ({ email, role }: ShareMenuInviteCallback) => void;
  disabled?: boolean;
  userEmails: string[];
}) {
  const [error, setError] = useState<string>('');
  const [email, setEmail] = useState<string>('');
  const [role, setRole] = useState<z.infer<typeof RoleSchema>>(RoleSchema.enum.EDITOR);
  const theme = useTheme();

  // TODO comma separate list someday

  // https://stackoverflow.com/a/9204568
  const reg = /\S+@\S+\.\S+/;
  const isValidEmail = reg.test(email);

  if (!isValidEmail || error) {
    disabled = true;
  }

  const optionsByRole = {
    [RoleSchema.enum.EDITOR]: { label: 'Can edit', onClick: () => setRole(RoleSchema.enum.EDITOR) },
    [RoleSchema.enum.VIEWER]: { label: 'Can view', onClick: () => setRole(RoleSchema.enum.VIEWER) },
  };
  const options = Object.values(optionsByRole);

  return (
    <Stack
      component="form"
      direction="row"
      alignItems="flex-start"
      gap={theme.spacing()}
      onSubmit={(e) => {
        e.preventDefault();
        if (disabled) return;

        onInvite({ email, role });
        setEmail('');
      }}
    >
      <Box sx={{ position: 'relative', flexGrow: 2 }}>
        <TextField
          error={Boolean(error)}
          helperText={error ? error : ''}
          autoComplete="off"
          aria-label="Email"
          placeholder="Email"
          variant="outlined"
          size="small"
          inputProps={{ sx: { fontSize: '.875rem' } }}
          value={email}
          onChange={(e) => {
            const newEmail = e.target.value;
            setEmail(newEmail);
            if (userEmails.includes(newEmail)) {
              setError('User already invited');
            } else if (error) {
              setError('');
            }
          }}
          fullWidth
        />
        <Box sx={{ position: 'absolute', right: theme.spacing(0.425), top: theme.spacing(0.425) }}>
          <UserPopoverMenu
            label={
              // @ts-expect-error TODO
              optionsByRole[role].label
            }
            options={options}
          />
        </Box>
      </Box>

      <Button type="submit" variant="contained" disableElevation disabled={disabled}>
        Invite
      </Button>
    </Stack>
  );
}

function PublicLink({
  publicLinkAccess,
  uuid,
  fetcherUrl,
}: {
  publicLinkAccess: PublicLinkAccess | undefined;
  uuid: string;
  fetcherUrl: string;
}) {
  const fetcher = useFetcher();

  // If we don’t have the value, assume 'not shared' by default because we need
  // _some_ value for the popover
  let public_link_access = publicLinkAccess ? publicLinkAccess : 'NOT_SHARED';
  // If we're updating, optimistically show the next value
  if (fetcher.json) {
    // @ts-expect-error
    public_link_access = fetcher.json.public_link_access;
    // public_link_access = fetcher.json /*TODO as Action['request.update-public-link-access'] */.public_link_access;
  }

  const setPublicLinkAccess = async (newValue: PublicLinkAccess) => {
    const data /*TODO : Action['request.update-public-link-access'] */ = {
      action: 'update-public-link-access',
      uuid: uuid,
      public_link_access: newValue,
    };
    fetcher.submit(data, {
      method: 'POST',
      action: fetcherUrl,
      encType: 'application/json',
    });
  };

  const options: Option[] = [
    { label: 'Cannot view', onClick: () => setPublicLinkAccess('NOT_SHARED') },
    { label: 'Can view', onClick: () => setPublicLinkAccess('READONLY') },
    { label: 'Can edit (coming soon)', onClick: () => setPublicLinkAccess('EDIT'), disabled: true },
  ];

  const label =
    public_link_access === 'NOT_SHARED' ? 'Cannot view' : public_link_access === 'READONLY' ? 'Can view' : 'Can edit';

  return (
    <>
      {public_link_access === 'NOT_SHARED' ? <PublicOff /> : <Public />}
      <Stack>
        <Typography variant="body2">Anyone with the link</Typography>
        {fetcher.state === 'idle' && fetcher.data && !fetcher.data.ok && (
          <Typography variant="caption" color="error">
            Failed to update
          </Typography>
        )}
      </Stack>

      <UserPopoverMenu label={label} options={options} />
    </>
  );
}

function Row({ children, sx }: { children: React.ReactNode; sx?: any }) {
  const theme = useTheme();
  return (
    <Stack
      direction="row"
      alignItems="center"
      gap={theme.spacing(1.5)}
      sx={{ minHeight: '2.5rem', '> :last-child': { marginLeft: 'auto' }, ...sx }}
    >
      {children}
    </Stack>
  );
}

export { ShareMenu };
