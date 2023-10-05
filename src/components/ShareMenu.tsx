import { Public, PublicOff } from '@mui/icons-material';
import {
  Alert,
  Avatar,
  Box,
  Button,
  Skeleton,
  SkeletonProps,
  Stack,
  TextField,
  Typography,
  useTheme,
} from '@mui/material';
import React, { useEffect, useState } from 'react';
import { useFetcher } from 'react-router-dom';
import { isOwner as isOwnerTest } from '../actions';
import { Permission, PermissionSchema, PublicLinkAccess } from '../api/types';
import { ShareFileMenuPopover } from './ShareFileMenuPopover';

/**
 * <ShareMenu> usage:
 *
 * <ShareMenu.Wrapper>
 *   <ShareMenu.Invite>
 *   <ShareMenu.ListItem>
 *   <ShareMenu.ListItem>
 */
ShareMenu.Wrapper = Wrapper;
ShareMenu.Invite = Invite;
ShareMenu.ListItem = ListItem;
ShareMenu.ListItemUserActions = UserActions;

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

export function ShareTeam(props: any) {
  const { users, onAddUser /*, onRemoveUser, onUpdateUser*/ } = props;

  return (
    <ShareMenu.Wrapper>
      <ShareMenu.Invite onInvite={onAddUser} userEmails={users.map(({ email }: any) => email)} />
      {users.map((user: any) => (
        <UserListItem key={user.email} user={user} isOwner={isOwnerTest(user.permission)} />
      ))}
    </ShareMenu.Wrapper>
  );
}

function ShareMenu({ fetcherUrl, permission, uuid }: any /* TODO */) {
  const theme = useTheme();
  const fetcher = useFetcher();
  const isLoading = Boolean(!fetcher.data?.ok);
  const animation = fetcher.state !== 'idle' ? 'pulse' : false;
  const owner = fetcher.data?.data?.owner;
  const publicLinkAccess = fetcher.data?.data?.public_link_access;
  // const isShared = publicLinkAccess && publicLinkAccess !== 'NOT_SHARED';
  const isOwner = isOwnerTest(permission);
  // const isDisabledCopyShareLink = showSkeletons ? true : !isShared;
  const showLoadingError = fetcher.state === 'idle' && fetcher.data && !fetcher.data.ok;
  const isFile = fetcherUrl.includes('/files/');

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

      <ShareMenu.Invite onInvite={() => {}} userEmails={[]} />

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
          {isFile && (
            <>
              <Row>
                <PublicLink
                  fetcherUrl={fetcherUrl}
                  animation={animation}
                  publicLinkAccess={publicLinkAccess}
                  isOwner={isOwner}
                  uuid={uuid}
                />
              </Row>
              {/* TODO <Row>Team</Row> */}
            </>
          )}
          <UserListItem user={owner} isOwner={isOwner} />
        </>
      )}
    </ShareMenu.Wrapper>
  );
}

function ListItem({ avatar, primary, secondary, action, error }: any) {
  return (
    <Row>
      {avatar}
      <Stack>
        <Typography variant="body2" color="text.primary">
          {primary}
        </Typography>
        {secondary && (
          <Typography variant="caption" color={error ? 'error' : 'text.secondary'}>
            {error ? error : secondary}
          </Typography>
        )}
      </Stack>
      <Box>{action}</Box>
    </Row>
  );
}

function UserListItem({ user, isOwner }: any /* TODO */) {
  // TODO figure out primary vs. secondary display
  const primary = user.name ? user.name : user.email;

  return (
    <Row>
      <Avatar sx={{ width: 24, height: 24 }} />
      <Stack>
        <Typography variant="body2" color="text.primary">
          {primary} {isOwner && ' (You)'}
        </Typography>
        <Typography variant="body2" color="text.secondary">
          {user.email}
        </Typography>
      </Stack>
      <Box sx={{ ml: 'auto' }}>
        <ShareFileMenuPopover value={'1'} disabled options={[{ label: 'Owner', value: '1' }]} setValue={() => {}} />
      </Box>
    </Row>
  );
}

const userMenuOptions = [
  { label: 'Owner', value: PermissionSchema.enum.OWNER },
  { label: 'Can edit', value: PermissionSchema.enum.EDITOR },
  { label: 'Can view', value: PermissionSchema.enum.VIEWER },
  // { isDivider: true },
  { label: 'Remove', value: '4' },
];
export type ShareMenuInviteCallback = { email: string; permission: Permission };
function Invite({
  onInvite,
  disabled,
  userEmails,
}: {
  onInvite: ({ email, permission }: ShareMenuInviteCallback) => void;
  disabled?: boolean;
  userEmails: string[];
}) {
  const [error, setError] = useState<string>('');
  const [email, setEmail] = useState<string>('');
  const [permission, setPermission] = useState<Permission>(PermissionSchema.enum.EDITOR);
  const theme = useTheme();

  // TODO comma separate list someday

  // https://stackoverflow.com/a/9204568
  const reg = /\S+@\S+\.\S+/;
  const isValidEmail = reg.test(email);

  if (!isValidEmail || error) {
    disabled = true;
  }

  return (
    <Stack
      component="form"
      direction="row"
      alignItems="flex-start"
      gap={theme.spacing()}
      onSubmit={(e) => {
        e.preventDefault();
        if (disabled) return;

        onInvite({ email, permission });
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
        <Box sx={{ position: 'absolute', right: theme.spacing(0.625), top: theme.spacing(0.625) }}>
          <ShareFileMenuPopover value={permission} options={userMenuOptions} setValue={setPermission} />
        </Box>
      </Box>

      <Button type="submit" variant="contained" disableElevation disabled={disabled}>
        Invite
      </Button>
    </Stack>
  );
}

function UserActions({ value, setValue }: any) {
  return (
    <ShareFileMenuPopover
      value={value}
      disabled={value === PermissionSchema.enum.OWNER}
      options={userMenuOptions}
      setValue={setValue}
    />
  );
}

const shareOptions: Array<{
  label: string;
  value: PublicLinkAccess;
  disabled?: boolean;
}> = [
  { label: 'Cannot view', value: 'NOT_SHARED' },
  { label: 'Can view', value: 'READONLY' },
  { label: 'Can edit (coming soon)', value: 'EDIT', disabled: true },
];

function PublicLink({
  animation,
  publicLinkAccess,
  isOwner,
  uuid,
  fetcherUrl,
}: {
  animation: SkeletonProps['animation'];
  publicLinkAccess: PublicLinkAccess | undefined;
  isOwner: boolean;
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
    public_link_access = fetcher.json /*TODO as Action['request.update-public-link-access'] */.public_link_access;
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

      <ShareFileMenuPopover
        value={public_link_access}
        disabled={!isOwner}
        options={shareOptions}
        setValue={setPublicLinkAccess}
      />
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
