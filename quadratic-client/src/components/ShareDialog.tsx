// TODO: incorporate team access to this modal, e.g. viewer can't invite people
import { TYPE } from '@/constants/appConstants';
import { TeamAction } from '@/routes/teams.$teamUuid';
import { Button as Button2 } from '@/shadcn/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/shadcn/ui/dialog';
import { Input } from '@/shadcn/ui/input';
import { Select, SelectContent, SelectItem, SelectSeparator, SelectTrigger, SelectValue } from '@/shadcn/ui/select';
import { cn } from '@/shadcn/utils';
import { Avatar, Skeleton, Typography } from '@mui/material';
import { EnvelopeClosedIcon, GlobeIcon, LockClosedIcon, PersonIcon } from '@radix-ui/react-icons';
import { ApiTypes, PublicLinkAccess, UserRoleFileSchema } from 'quadratic-shared/typesAndSchemas';
import React, { Children, useRef } from 'react';
import { useFetcher, useFetchers, useParams, useSearchParams, useSubmit } from 'react-router-dom';
import { UserRoleTeam } from '../permissions';
import { AvatarWithLetters } from './AvatarWithLetters';
import { getTeamUserOption } from './ShareMenu.utils';

// Possible values: `?share` | `?share=team-created`
export const shareSearchParamKey = 'share';
export const shareSearchParamValuesById = {
  OPEN: '',
  TEAM_CREATED: 'team-created',
};

function getRoleLabel(role: string) {
  if (role === 'OWNER') {
    return 'Owner';
  } else if (role === 'EDITOR') {
    return 'Can edit';
  } else if (role === 'VIEWER') {
    return 'Can view';
  } else if (role === 'DELETE') {
    return 'Remove';
    // return isLoggedInUser ? 'Leave' : 'Remove';
  }

  // We should never reach here
  // TODO: add types so we don't
  return 'Can edit';
}

// Simplified type definitions
type JsonPrimitive = string | number | boolean | null;
type JsonArray = Array<JsonValue>;
interface JsonObject {
  [key: string]: JsonValue;
}
type JsonValue = JsonPrimitive | JsonObject | JsonArray;
// Type guard to check if a value is a JsonObject
function isJsonObject(value: any): value is JsonObject {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function ShareTeamDialog({
  data,
  onClose,
}: {
  data: ApiTypes['/v0/teams/:uuid.GET.response'];
  onClose: () => void;
}) {
  const {
    user: loggedInUser,
    team: { users, invites, name, uuid },
  } = data;
  const numberOfOwners = users.filter((user) => user.role === 'OWNER').length;

  // Sort the users how we want
  const sortedUsers = users.toSorted((a, b) => {
    // Move the logged in user to the front
    if (a.id === loggedInUser.id && b.id !== loggedInUser.id) return -1;
    // Keep the logged in user at the front
    if (a.id !== loggedInUser.id && b.id === loggedInUser.id) return 1;
    // Leave the order as is for others
    return 0;
  });

  // TODO:(enhancement) error state when these fail

  const pendingInvites = useFetchers()
    .filter(
      (fetcher) =>
        isJsonObject(fetcher.json) && fetcher.json.intent === 'create-team-invite' && fetcher.state !== 'idle'
    )
    .map((fetcher, i) => {
      const data = fetcher.json as TeamAction['request.create-team-invite'];
      return {
        id: i,
        ...data.payload,
      };
    });

  // Get all emails of users and pending invites so user can't input them
  const currentTeamEmails = sortedUsers.map((user) => user.email).concat(pendingInvites.map((invite) => invite.email));

  return (
    <ShareDialog title={`Share ${name}`} description="Invite people to collaborate in this team" onClose={() => {}}>
      <InviteUser
        onInviteUser={({ email, role }: any) => {
          // setPendingInvites((prev) => [...prev, { email, role }]);
        }}
        canInviteOwner={loggedInUser.role === 'OWNER' && numberOfOwners > 1}
        actionUrl={`/teams/${uuid}`}
        userEmails={currentTeamEmails}
        loggedInUser={loggedInUser}
      />

      {sortedUsers.map((user, i) => (
        <ManageUser key={user.id} numberOfOwners={numberOfOwners} loggedInUser={loggedInUser} user={user} />
      ))}

      {invites.map((invite) => (
        <ManageInvite key={invite.id} invite={invite} loggedInUser={loggedInUser} />
      ))}
      {pendingInvites.map((invite, i) => (
        <ManageInvite key={i} invite={invite} loggedInUser={loggedInUser} disabled={true} />
      ))}
    </ShareDialog>
  );
}

export function ShareFileDialog({ uuid, name, onClose, fetcherUrl }: any) {
  const isLoading = false;

  // TODO: get file name from fetched data
  return (
    <ShareDialog title={`Share ${name}`} description="Invite people to collaborate on this file" onClose={() => {}}>
      {isLoading ? (
        <ListItemLoading />
      ) : (
        <>
          <InviteUser
            onInviteUser={() => {}}
            canInviteOwner={false}
            actionUrl={`/files/${uuid}/sharing`}
            userEmails={[]}
            loggedInUser={{}}
          />
          <ListItemPublicLink fetcherUrl={fetcherUrl} publicLinkAccess={'EDIT'} />
          <ListItemTeamMember teamName={'TODO:'} />
        </>
      )}
    </ShareDialog>
  );
}

export function ShareDialog({ onClose, title, description, children }: any) {
  return (
    <Dialog open={true} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader className={`mr-6 overflow-hidden`}>
          <DialogTitle className={`truncate`}>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <div className={`flex flex-col gap-4`}>{children}</div>
      </DialogContent>
    </Dialog>
  );
}

function ListItemTeamMember({ teamName }: { teamName: string }) {
  return (
    <ListItem>
      <div className={`flex h-6 w-6 items-center justify-center`}>
        <PersonIcon className={`h-5 w-5`} />
      </div>
      <p className={`${TYPE.body2}`}>Everyone in {teamName} can access this file</p>
    </ListItem>
  );
}

type InviteUserProps = {
  loggedInUser: any; // ApiTypes['/v0/teams/:uuid.GET.response'];
  onInviteUser: (user: { email: string; role: string }) => void;
  userEmails: string[];
  actionUrl: string;
  canInviteOwner: boolean;

  // userRoles: Array<{ label: string; value: string }>;
};
export function InviteUser({ loggedInUser, userEmails, actionUrl, canInviteOwner, onInviteUser }: InviteUserProps) {
  // **** INVITE
  // const [error, setError] = useState<string>('');
  // const [role, setRole] = useState<z.infer<typeof RoleSchema>>(RoleSchema.enum.EDITOR);
  const [searchParams, setSearchParams] = useSearchParams();
  // const submit = useSubmit();
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
    { label: 'Can edit', value: UserRoleFileSchema.enum.EDITOR },
    { label: 'Can view', value: UserRoleFileSchema.enum.VIEWER },
    // ...(canInviteOwner ? { label: 'Owner', value: UserRoleFileSchema.enum.OWNER } : {}),
  ];
  const inputRef = useRef<HTMLInputElement>(null);
  const submit = useSubmit();

  // **** INVITE

  return (
    <form
      className={`flex flex-row items-start gap-2`}
      onSubmit={(e) => {
        e.preventDefault();

        const formData = new FormData(e.currentTarget);
        const payload = Object.fromEntries(formData) as TeamAction['request.create-team-invite']['payload'];
        // onInviteUser(payload);

        // TODO: validate

        // TODO: types for different contexts
        const data: TeamAction['request.create-team-invite'] = {
          intent: 'create-team-invite',
          payload,
        };
        submit(data, { method: 'POST', action: actionUrl, encType: 'application/json', navigate: false });

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
  );
}

function ManageInvite({
  invite,
  loggedInUser,
  disabled,
}: {
  invite: ApiTypes['/v0/teams/:uuid.GET.response']['team']['invites'][0];
  loggedInUser: ApiTypes['/v0/teams/:uuid.GET.response']['user'];
  disabled?: boolean;
}) {
  const fetcher = useFetcher();
  const { teamUuid } = useParams() as { teamUuid: string };

  const { email, role, id } = invite;
  const inviteId = String(id);
  let hasError = false;

  // If we're not idle, we're deleting
  if (fetcher.state !== 'idle') {
    return null;
  }

  // If it failed, trigger an error
  if (fetcher.state === 'idle' && fetcher.data && !fetcher.data.ok) {
    hasError = true;
  }

  // TODO: resend email functionality

  return (
    <UserBase
      avatar={
        <Avatar sx={{ width: '24px', height: '24px' }}>
          <EnvelopeClosedIcon />
        </Avatar>
      }
      primary={email}
      secondary={hasError ? 'Failed to delete, try again' : 'Invite sent'}
      hasError={hasError}
      action={
        <Select
          value={role}
          onValueChange={(newValue: string) => {
            const data: TeamAction['request.delete-team-invite'] = { intent: 'delete-team-invite', inviteId };
            fetcher.submit(data, {
              method: 'POST',
              // TODO: consider removing these as it's implied by the current location
              action: `/teams/${teamUuid}`,
              encType: 'application/json',
            });
          }}
        >
          <SelectTrigger disabled={disabled}>{getRoleLabel(role)}</SelectTrigger>
          <SelectContent>
            <SelectItem value={role}>{getRoleLabel(role)}</SelectItem>
            {loggedInUser.access.includes('TEAM_EDIT') && (
              <>
                <SelectSeparator key="divider" />
                <SelectItem value="DELETE">Remove</SelectItem>
              </>
            )}
          </SelectContent>
        </Select>
      }
    />
  );
}

function UserBase({ avatar, primary, secondary, action, hasError, isLoggedInUser }: any) {
  return (
    <ListItem>
      <div>{avatar}</div>
      <div className={`flex flex-col`}>
        <div className={`${TYPE.body2}`}>
          {primary} {isLoggedInUser && ' (You)'}
        </div>
        {secondary && (
          <div className={cn(TYPE.caption, hasError ? 'text-destructive' : 'text-muted-foreground')}>{secondary}</div>
        )}
      </div>

      {action && <div>{action}</div>}
    </ListItem>
  );
}

function ManageUser({
  numberOfOwners,
  loggedInUser,
  user,
}: {
  numberOfOwners: number;
  loggedInUser: ApiTypes['/v0/teams/:uuid.GET.response']['user'];
  user: ApiTypes['/v0/teams/:uuid.GET.response']['team']['users'][0];
}) {
  const { teamUuid } = useParams() as { teamUuid: string };
  const fetcher = useFetcher();
  const fetcherJson = fetcher.json as TeamAction['request.update-team-user'] | TeamAction['request.delete-team-user'];
  const actionUrl = `/teams/${teamUuid}`;
  const primary = (user.name ? user.name : user.email) + (loggedInUser.id === user.id ? ' (You)' : '');
  let secondary = user.name ? user.email : '';
  let value = user.role;
  let hasError = false;

  // If user is being deleted, hide them
  if (fetcher.state !== 'idle' && fetcherJson.intent === 'delete-team-user') {
    return null;
  }

  // If the user's role is being updated, show the optimistic value
  if (fetcher.state !== 'idle' && fetcherJson.intent === 'update-team-user') {
    value = fetcherJson.payload.role;
  }

  // If there was an error, show it
  if (fetcher.state !== 'submitting' && fetcher.data && !fetcher.data.ok) {
    hasError = true;
    secondary = 'Failed to update. Try again.';
  }

  const options = getTeamUserOption({
    user,
    loggedInUser,
    numberOfOwners,
    // TODO: teams? yes. files? no.
    // canHaveMoreThanOneOwner: true,
  });

  return (
    <UserBase
      avatar={
        <AvatarWithLetters src={user.picture} size="small">
          {user.name ? user.name : user.email}
        </AvatarWithLetters>
      }
      primary={primary}
      secondary={secondary}
      hasError={hasError}
      action={
        <Select
          value={value}
          onValueChange={(
            newValue: ApiTypes['/v0/teams/:uuid.GET.response']['user']['role'] | 'DELETE'
            // type for files
            // | ApiTypes['/v0/files/:uuid.GET.response']['user']['role']
          ) => {
            const userId = String(user.id);
            if (newValue === 'DELETE') {
              const data: TeamAction['request.delete-team-user'] = { intent: 'delete-team-user', userId };
              fetcher.submit(data, {
                method: 'POST',
                action: actionUrl,
                encType: 'application/json',
              });
            } else {
              const data: TeamAction['request.update-team-user'] = {
                intent: 'update-team-user',
                userId,
                payload: { role: newValue },
              };
              fetcher.submit(data, {
                method: 'POST',
                action: actionUrl,
                encType: 'application/json',
              });
            }
          }}
          name="role"
          disabled={options.length < 2}
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {options.map((option, i) => {
              const labelsByOption = {
                OWNER: 'Owner',
                EDITOR: 'Can edit',
                VIEWER: 'Can view',
                DELETE: loggedInUser.id === user.id ? 'Leave' : 'Remove',
              };

              const label = labelsByOption[option];

              return [
                option === 'DELETE' ? <SelectSeparator key={i + '-divider'} /> : null,
                <SelectItem key={i} value={option}>
                  {label}
                </SelectItem>,
              ];
            })}
          </SelectContent>
        </Select>
      }
    />
  );
}

function ListItemLoading() {
  return (
    <ListItem>
      <Skeleton variant="circular" animation="pulse" width={24} height={24} />
      <Skeleton width={160} />
      <Skeleton width={120} />
    </ListItem>
  );
}

// function ShareMenu({ fetcherUrl, uuid }: { fetcherUrl: string; uuid: string }) {
//   const theme = useTheme();
//   const fetcher = useFetcher();

//   const [users, setUsers] = useState([]); // TODO types
//   const isLoading = Boolean(!fetcher.data?.ok);
//   // const owner = fetcher.data?.data?.owner;
//   const publicLinkAccess = fetcher.data?.data?.public_link_access;
//   // const isShared = publicLinkAccess && publicLinkAccess !== 'NOT_SHARED';
//   // const isDisabledCopyShareLink = showSkeletons ? true : !isShared;
//   const showLoadingError = fetcher.state === 'idle' && fetcher.data && !fetcher.data.ok;
//   // const isFile = fetcherUrl.includes('/files/');
//   const canEdit = true; // TODO fetcher.data.permission.access.includes('FILE_EDIT');;

//   // On the initial mount, load the data (if it's not there already)
//   useEffect(() => {
//     if (fetcher.state === 'idle' && !fetcher.data) {
//       fetcher.load(fetcherUrl);
//     }
//   }, [fetcher, fetcherUrl]);

//   return (
//     <ShareMenu.Wrapper>
//       {showLoadingError && (
//         <Alert
//           severity="error"
//           action={
//             <Button
//               color="inherit"
//               size="small"
//               onClick={() => {
//                 fetcher.load(fetcherUrl);
//               }}
//             >
//               Reload
//             </Button>
//           }
//           sx={{
//             // Align the alert so it's icon/button match each row item
//             px: theme.spacing(3),
//             mx: theme.spacing(-3),
//           }}
//         >
//           Failed to retrieve sharing info. Try reloading.
//         </Alert>
//       )}

//       {false && canEdit && (
//         <ShareMenu.Invite
//           onInvite={({ email, role }) => {
//             // @ts-expect-error
//             setUsers((prev: any) => [...prev, { email, role }]);
//           }}
//           userEmails={users.map(({ email }) => email)}
//         />
//       )}

//       {isLoading ? (
//         <>
//           <Row>
//             <Loading />
//           </Row>
//         </>
//       ) : (
//         <>
//           {canEdit && (
//             <>
//               <Row>
//                 <PublicLink fetcherUrl={fetcherUrl} publicLinkAccess={publicLinkAccess} />
//               </Row>
//               {/* TODO <Row>Team</Row> */}
//             </>
//           )}
//           {/* <UserListItem users={users} user={owner} isOwner={isOwner} /> */}
//         </>
//       )}
//     </ShareMenu.Wrapper>
//   );
// }

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

function ListItemPublicLink({
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
    <ListItem>
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
    </ListItem>
  );
}

// eslint-disable-next-line
function Row({ children, sx }: { children: React.ReactNode; sx?: any }) {
  if (Children.count(children) !== 3) {
    console.warn('<Row> expects exactly 3 children');
  }

  return <div className={'flex flex-row items-center gap-3 [&>:last-child]:ml-auto'}>{children}</div>;
}

function ListItem({ children }: { children: React.ReactNode }) {
  if (Children.count(children) !== 3) {
    console.warn('<ListItem> expects exactly 3 children');
  }

  return <div className={'flex flex-row items-center gap-3 [&>:nth-child(3)]:ml-auto'}>{children}</div>;
}
