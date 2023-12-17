import { TYPE } from '@/constants/appConstants';
import { Button as Button2 } from '@/shadcn/ui/button';
import { Input } from '@/shadcn/ui/input';
import { Select, SelectContent, SelectItem, SelectSeparator, SelectTrigger, SelectValue } from '@/shadcn/ui/select';
import { cn } from '@/shadcn/utils';
import { ArrowDropDown, Check, EmailOutlined } from '@mui/icons-material';
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
import { GlobeIcon, LockClosedIcon, PersonIcon } from '@radix-ui/react-icons';
import { ApiTypes, PublicLinkAccess } from 'quadratic-shared/typesAndSchemas';
import React, { Children, useEffect, useRef, useState } from 'react';
import { useFetcher, useSearchParams } from 'react-router-dom';
import { z } from 'zod';
import { RoleSchema, UserRoleTeam } from '../permissions';
import { AvatarWithLetters } from './AvatarWithLetters';
import { getUserShareOptions } from './ShareMenu.utils';

// Possible values: `?share` | `?share=team-created`
export const shareSearchParamKey = 'share';
export const shareSearchParamValuesById = {
  OPEN: '',
  TEAM_CREATED: 'team-created',
};

const rowClassName = 'flex flex-row items-center gap-3 [&>:nth-child(3)]:ml-auto';

/**
 * <ShareMenu> usage:
 *
 * <ShareMenu.Wrapper>
 *   <ShareMenu.Invite>
 *   <ShareMenu.Users>
 */
ShareMenu.Wrapper = Wrapper;
ShareMenu.Invite = Invite;
// ShareMenu.Users = Users;
ShareMenu.UserListItem = UserListItem;

export function Share({ loggedInUser, context, onInviteUser, onRemoveUser, onChangeUser, users }: any) {
  // **** INVITE
  // const [error, setError] = useState<string>('');
  // const [role, setRole] = useState<z.infer<typeof RoleSchema>>(RoleSchema.enum.EDITOR);
  const [searchParams, setSearchParams] = useSearchParams();

  // TODO comma separate list someday

  // https://stackoverflow.com/a/9204568
  // const reg = /\S+@\S+\.\S+/;
  // const isValidEmail = reg.test(email);
  // let disabled = false;
  // if (!isValidEmail || error) {
  //   disabled = true;
  // }

  // TODO proper form validation based on schema etc

  const options = [
    // TODO: if can invite owner, allow here
    // TODO: context: team/file and proper enums
    { label: 'Can edit', value: RoleSchema.enum.EDITOR },
    { label: 'Can view', value: RoleSchema.enum.VIEWER },
  ];
  const inputRef = useRef<HTMLInputElement>(null);

  // **** INVITE

  return (
    <div className={`flex flex-col gap-4`}>
      <form
        className={`flex flex-row items-start gap-2`}
        onSubmit={(e) => {
          e.preventDefault();

          const formData = new FormData(e.currentTarget);
          const json = Object.fromEntries(formData);
          const { email, role } = json;

          // TODO: validate

          onInviteUser({ email, role });

          // Reset the input & focus
          if (inputRef.current) {
            inputRef.current.value = '';
            inputRef.current.focus();
          }

          // If we have ?share=team-created, turn it into just ?share
          if (searchParams.get(shareSearchParamKey) === shareSearchParamValuesById.TEAM_CREATED) {
            setSearchParams((prevParams: URLSearchParams) => {
              const newParams = new URLSearchParams(prevParams);
              newParams.set(shareSearchParamKey, '');
              return newParams;
            });
          }
        }}
      >
        <Input
          // error={Boolean(error)}
          // helperText={error ? error : ''}
          className="flex-grow"
          autoComplete="off"
          aria-label="Email"
          placeholder="Email"
          name="email"
          autoFocus
          ref={inputRef}
          // pattern="/\S+@\S+\.\S+/"
          // variant="outlined"
          // size="small"
          // inputProps={{ sx: { fontSize: '.875rem' } }}
          // value={email}
          // onChange={(e) => {
          //   const newEmail = e.target.value;
          //   setEmail(newEmail);
          //   if (users.map((user: any) => user.email).includes(newEmail)) {
          //     setError('User already invited');
          //   } else if (error) {
          //     setError('');
          //   }
          // }}
        />

        <div className="flex-shrink-0">
          <Select defaultValue={options[0].value} name="role">
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {options.map(({ label, value }, key) => (
                <SelectItem key={value} value={value}>
                  {label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <Button2 type="submit">Invite</Button2>
      </form>

      {/* TODO: File-specific items */}
      <PublicLink fetcherUrl={'/files/12345'} publicLinkAccess={'EDIT'} />
      {/* TODO: if it's a file and its part of a team, show that here */}
      <div className={rowClassName}>
        <div className={`flex h-6 w-6 items-center justify-center`}>
          <PersonIcon className={`h-5 w-5`} />
        </div>
        <p className={`${TYPE.body2}`}>Everyone in {`{{team}}`} can access this file</p>
      </div>

      {users.map((user: any, i: number) => (
        <UserListItem2
          key={i}
          numberOfOwners={users.filter((user: any) => user.role === 'OWNER').length}
          loggedInUser={loggedInUser}
          user={user}
          onUpdateUser={onChangeUser}
          onDeleteUser={onRemoveUser}
        />
      ))}
    </div>
  );
}

function UserListItem2({
  numberOfOwners,
  loggedInUser,
  user,
  onUpdateUser,
  onDeleteUser,
  disabled,
  error,
}: {
  numberOfOwners: number;
  loggedInUser: ApiTypes['/v0/teams/:uuid.GET.response']['user'];
  user: ApiTypes['/v0/teams/:uuid.GET.response']['team']['users'][0];
  onUpdateUser: any; // (userId: number, role: ApiTypes['/v0/teams/:uuid.GET.response']['team']['users'][0]['role']) => void;
  onDeleteUser: any; // (userId: number) => void;
  disabled?: boolean;
  error?: string;
}) {
  // TODO: figure out primary vs. secondary display & "resend"
  const primary = user.name ? user.name : user.email;

  // TODO: user.permissions.status === 'INVITE_SENT';
  const isPending = false;

  let secondary;
  if (error) {
    secondary = error;
  } else if (user.hasAccount) {
    secondary = user.email;
  } else {
    secondary = (
      <div className={`flex flex-row gap-1`}>
        Invite sent.{' '}
        <Button2 size="sm" variant="link">
          Resend
        </Button2>
      </div>
    );
  }

  let labels = disabled
    ? user.role === 'OWNER'
      ? ['Owner']
      : user.role === 'EDITOR'
      ? ['Can edit']
      : ['Can view']
    : getUserShareOptions({
        user,
        loggedInUser,
        numberOfOwners,
        canHaveMoreThanOneOwner: true, // TODO: teams? yes. files? no.
      });
  let options: Array<{ label: string; value: string; divider?: boolean }> = [];
  labels.forEach((label) => {
    if (label === 'Owner') {
      options.push({
        label,
        value: RoleSchema.enum.OWNER,
      });
    }
    if (label === 'Can edit') {
      options.push({
        label,
        value: RoleSchema.enum.EDITOR,
      });
    }
    if (label === 'Can view') {
      options.push({
        label,
        value: RoleSchema.enum.VIEWER,
      });
    }
    if (label === 'Leave' || label === 'Remove') {
      options.push(
        { label: '', value: '', divider: true },
        {
          label,
          // TODO if 'leave' then redirect user to dashboard
          value: 'DELETE',
        }
      );
    }
  });

  return (
    <form
      className={rowClassName}
      onChange={(e) => {
        e.preventDefault();

        const formData = new FormData(e.currentTarget);
        const json = Object.fromEntries(formData);
        const { role } = json;
        if (role === 'DELETE') {
          onDeleteUser({ userId: user.id });
        } else {
          onUpdateUser({ userId: user.id, role });
        }
      }}
    >
      {isPending ? (
        <Avatar sx={{ width: 24, height: 24, fontSize: '1rem' }}>
          <EmailOutlined fontSize="inherit" />
        </Avatar>
      ) : (
        <AvatarWithLetters src={user.picture} size="small">
          {user.name ? user.name : user.email}
        </AvatarWithLetters>
      )}
      <div className={`flex flex-col`}>
        <p className={`${TYPE.body2}`}>
          {primary} {loggedInUser.id === user.id && ' (You)'}
        </p>
        {secondary && (
          <p className={cn(TYPE.caption, error ? 'text-destructive' : 'text-muted-foreground')}>{secondary}</p>
        )}
      </div>
      <div className={`ml-auto`}>
        <Select defaultValue={user.role} name="role" disabled={options.length < 2}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {options.map((option, key) => {
              if (option.divider) {
                return <SelectSeparator key={key} />;
              }
              const { label, value } = option;

              return (
                <SelectItem key={key} value={value}>
                  {label}
                </SelectItem>
              );
            })}
          </SelectContent>
        </Select>
      </div>
    </form>
  );
}

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

  const [users, setUsers] = useState([]); // TODO types
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

      {false && canEdit && (
        <ShareMenu.Invite
          onInvite={({ email, role }) => {
            // @ts-expect-error
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
        </>
      ) : (
        <>
          {canEdit && (
            <>
              <Row>
                <PublicLink fetcherUrl={fetcherUrl} publicLinkAccess={publicLinkAccess} />
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

// function Users({
//   users,
//   loggedInUser,
//   onUpdateUser,
//   onDeleteUser,
// }: {
//   users: any /* TODO */;
//   loggedInUser: { email: string; role: Role; access: Access[] };
//   onUpdateUser: (user: any /* TODO UserShare */) => void;
//   onDeleteUser: (user: any /* TODO UserShare */) => void;
// }) {
//   const [searchParams] = useSearchParams();
//   const shareValue = searchParams.get(shareSearchParamKey);
//   const showTeamCreatedMessage = shareValue === shareSearchParamValuesById.TEAM_CREATED;

//   const theme = useTheme();

//   // TODO export search param values
//   // TODO make the query param disappear when you add things

//   return (
//     <>
//       {users.map((user: any, i: number) => {
//         return (
//           <UserListItem
//             key={user.email}
//             users={users}
//             loggedInUser={loggedInUser}
//             user={user}
//             onUpdateUser={onUpdateUser}
//             onDeleteUser={onDeleteUser}
//           />
//         );
//       })}

//       {showTeamCreatedMessage && (
//         <Stack
//           sx={{
//             p: '1rem',
//             position: 'relative',
//             alignItems: 'center',
//             borderTop: `1px dotted ${theme.palette.divider}`,
//             // background: 'lightyellow',
//             // mt: '.5rem',
//           }}
//         >
//           <CelebrationOutlined sx={{ color: 'text.disabled', my: '.5rem' }} />
//           <Typography variant="body1" color="text.secondary">
//             Team created
//           </Typography>
//           <Typography variant="body2" color="text.secondary">
//             Invite people to your team to collaborate on files.
//           </Typography>
//           {/* <IconButton sx={{ position: 'absolute', top: '.25rem', right: '.25rem', fontSize: '.875rem' }}>
//           <Close fontSize={'inherit'} />
//         </IconButton> */}
//         </Stack>
//       )}
//     </>
//   );
// }

function UserListItem({
  numberOfOwners,
  loggedInUser,
  user,
  onUpdateUser,
  onDeleteUser,
  disabled,
  error,
}: {
  numberOfOwners: number;
  loggedInUser: ApiTypes['/v0/teams/:uuid.GET.response']['user'];
  user: ApiTypes['/v0/teams/:uuid.GET.response']['team']['users'][0];
  onUpdateUser: (userId: number, role: ApiTypes['/v0/teams/:uuid.GET.response']['team']['users'][0]['role']) => void;
  onDeleteUser: (userId: number) => void;
  disabled?: boolean;
  error?: string;
}) {
  // TODO figure out primary vs. secondary display & "resend"
  const primary = user.name ? user.name : user.email;
  const theme = useTheme();

  const isPending = false; // TODO user.permissions.status === 'INVITE_SENT';

  let secondary;
  if (error) {
    secondary = error;
  } else if (user.hasAccount) {
    secondary = user.email;
  } else {
    secondary = (
      <Stack direction="row" gap={theme.spacing(0.5)}>
        Invite sent.{' '}
        <ButtonBase sx={{ textDecoration: 'underline', fontSize: 'inherit', fontFamily: 'inherit' }}>Resend</ButtonBase>
      </Stack>
    );
  }

  let labels = disabled
    ? user.role === 'OWNER'
      ? ['Owner']
      : user.role === 'EDITOR'
      ? ['Can edit']
      : ['Can view']
    : getUserShareOptions({
        user,
        loggedInUser,
        numberOfOwners,
        canHaveMoreThanOneOwner: true, // TODO teams? yes. files? no.
      });
  let options: Option[] = [];
  labels.forEach((label) => {
    if (label === 'Owner') {
      options.push({
        label,
        onClick: () => onUpdateUser(user.id, RoleSchema.enum.OWNER),
      });
    }
    if (label === 'Can edit') {
      options.push({
        label,
        onClick: () => onUpdateUser(user.id, RoleSchema.enum.EDITOR),
      });
    }
    if (label === 'Can view') {
      options.push({
        label,
        onClick: () => onUpdateUser(user.id, RoleSchema.enum.VIEWER),
      });
    }
    if (label === 'Leave' || label === 'Remove') {
      options.push(
        { divider: true },
        {
          label,
          onClick: () => {
            onDeleteUser(user.id);
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
          <Typography variant="caption" color={error ? 'error.main' : 'text.secondary'}>
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

export type ShareMenuInviteCallback = { email: string; role: UserRoleTeam /* TODO */ };
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
  const [searchParams, setSearchParams] = useSearchParams();

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
    <form
      className={`flex flex-row items-start gap-2`}
      onSubmit={(e) => {
        e.preventDefault();
        if (disabled) return;

        onInvite({ email, role });
        setEmail('');

        // If we have ?share=team-created, turn it into just ?share
        if (searchParams.get(shareSearchParamKey) === shareSearchParamValuesById.TEAM_CREATED) {
          setSearchParams((prevParams: URLSearchParams) => {
            const newParams = new URLSearchParams(prevParams);
            newParams.set(shareSearchParamKey, '');
            return newParams;
          });
        }
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
    </form>
  );
}

function PublicLink({
  publicLinkAccess,
  fetcherUrl,
}: {
  publicLinkAccess: PublicLinkAccess | undefined;
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
      public_link_access: newValue,
    };
    fetcher.submit(data, {
      method: 'POST',
      action: fetcherUrl,
      encType: 'application/json',
    });
  };

  const optionsByValue: Record<PublicLinkAccess, { label: string; disabled?: boolean }> = {
    NOT_SHARED: { label: 'Cannot view' },
    READONLY: { label: 'Can view' },
    EDIT: { label: 'Can edit' },
  };

  const activeOptionLabel = optionsByValue[public_link_access].label;

  return (
    <Row>
      <div className="flex h-6 w-6 items-center justify-center">
        {public_link_access === 'NOT_SHARED' ? (
          <LockClosedIcon className={`h-5 w-5`} />
        ) : (
          <GlobeIcon className={`h-5 w-5`} />
        )}
      </div>

      <div className={`flex flex-col`}>
        <p className={`${TYPE.body2}`}>Anyone with the link</p>
        {fetcher.state === 'idle' && fetcher.data && !fetcher.data.ok && (
          <Typography variant="caption" color="error">
            Failed to update
          </Typography>
        )}
      </div>

      <Select
        value={public_link_access}
        onValueChange={(value: PublicLinkAccess) => {
          setPublicLinkAccess(value);
        }}
      >
        <SelectTrigger className={`w-auto`}>
          <SelectValue>{activeOptionLabel}</SelectValue>
        </SelectTrigger>
        <SelectContent>
          {Object.entries(optionsByValue).map(([value, { label, disabled }]) => (
            <SelectItem value={value} disabled={disabled} key={value}>
              {label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </Row>
  );
}

function Row({ children, sx }: { children: React.ReactNode; sx?: any }) {
  if (Children.count(children) !== 3) {
    console.warn('<Row> expects exactly 3 children');
  }

  return <div className={'flex flex-row items-center gap-3 [&>:last-child]:ml-auto'}>{children}</div>;
}

export { ShareMenu };
