import { ROUTES } from '@/constants/routes';
import { Action as FileShareAction } from '@/routes/files.$uuid.sharing';
import { TeamAction } from '@/routes/teams.$teamUuid';
import { Button } from '@/shadcn/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/shadcn/ui/dialog';
import { Input } from '@/shadcn/ui/input';
import { Select, SelectContent, SelectItem, SelectSeparator, SelectTrigger, SelectValue } from '@/shadcn/ui/select';
import { Skeleton } from '@/shadcn/ui/skeleton';
import { isJsonObject } from '@/utils/isJsonObject';
import { Avatar } from '@mui/material';
import { EnvelopeClosedIcon, GlobeIcon, LockClosedIcon } from '@radix-ui/react-icons';
import {
  ApiTypes,
  PublicLinkAccess,
  UserRoleFile,
  UserRoleFileSchema,
  UserRoleTeam,
  UserRoleTeamSchema,
  emailSchema,
} from 'quadratic-shared/typesAndSchemas';
import React, { Children, FormEvent, useEffect, useRef, useState } from 'react';
import { useFetcher, useFetchers, useParams, useSubmit } from 'react-router-dom';
import { AvatarWithLetters } from './AvatarWithLetters';
import { getTeamUserOption } from './ShareMenu.utils';
import { Type } from './Type';

function getRoleLabel(role: UserRoleTeam | UserRoleFile | 'DELETE') {
  // prettier-ignore
  return (
    role === 'OWNER' ? 'Owner' :
    role === 'EDITOR' ? 'Can edit' :
    role === 'VIEWER' ? 'Can view' :
    'Remove'
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
      const { email, role } = fetcher.json as TeamAction['request.create-team-invite'];
      return {
        id: i,
        email,
        role,
      };
    });

  // Get all emails of users and pending invites so user can't input them
  const exisitingTeamEmails = [
    ...sortedUsers.map((user) => user.email),
    ...invites.map((invite) => invite.email),
    ...pendingInvites.map((invite) => invite.email),
  ];

  // TODO: combine into one list that's sorted by date added

  return (
    <ShareDialog title={`Share ${name}`} description="Invite people to collaborate in this team" onClose={onClose}>
      <InviteForm
        action={`/teams/${uuid}`}
        intent="create-team-invite"
        disallowedEmails={exisitingTeamEmails}
        roles={[UserRoleTeamSchema.enum.EDITOR, UserRoleTeamSchema.enum.VIEWER]}
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
  const fetcher = useFetcher();
  const isLoading = !fetcher.data;
  let publicLinkAccess = isLoading ? '' : fetcher.data.data.public_link_access;

  // const isShared = publicLinkAccess && publicLinkAccess !== 'NOT_SHARED';
  // const isDisabledCopyShareLink = isLoading ? true : !isShared;
  // const showLoadingError = fetcher.state === 'idle' && fetcher.data && !fetcher.data.ok;
  // const isFile = fetcherUrl.includes('/files/');
  // const canEdit = true; // TODO fetcher.data.permission.access.includes('FILE_EDIT');;

  // On the initial mount, load the data (if it's not there already)
  useEffect(() => {
    if (fetcher.state === 'idle' && !fetcher.data) {
      fetcher.load(ROUTES.FILES_SHARE(uuid));
    }
  }, [fetcher, uuid]);

  // TODO: get file name from fetched data
  return (
    <ShareDialog title={`Share ${name}`} description="Invite people to collaborate on this file" onClose={onClose}>
      {isLoading ? (
        <ListItemLoading />
      ) : (
        <>
          <InviteForm
            action={`/files/${uuid}/sharing`}
            // @ts-expect-error
            intent=""
            disallowedEmails={[]}
            roles={[UserRoleFileSchema.enum.EDITOR, UserRoleFileSchema.enum.VIEWER]}
          />
          <PublicLink uuid={uuid} publicLinkAccess={publicLinkAccess} />
          {/* <ListItemTeamMember teamName={'TODO:'} /> */}
        </>
      )}
    </ShareDialog>
  );
}

// function ListItemTeamMember({ teamName }: { teamName: string }) {
//   return (
//     <ListItem>
//       <div className={`flex h-6 w-6 items-center justify-center`}>
//         <PersonIcon className={`h-5 w-5`} />
//       </div>
//       <Type variant="body2">Everyone in {teamName} can access this file</Type>
//     </ListItem>
//   );
// }

export function InviteForm({
  disallowedEmails,
  action,
  intent,
  // TODO:(enhancement) allow inviting owners, which requires backend support
  roles,
}: {
  disallowedEmails: string[];
  intent: TeamAction['request.create-team-invite']['intent'];
  action: string;
  roles: (UserRoleTeam | UserRoleFile)[];
}) {
  const [error, setError] = useState<string>('');
  const inputRef = useRef<HTMLInputElement>(null);
  const submit = useSubmit();
  const deleteTriggered =
    useFetchers().filter(
      (fetcher) =>
        fetcher.state === 'submitting' &&
        isJsonObject(fetcher.json) &&
        typeof fetcher.json.intent === 'string' &&
        fetcher.json.intent.includes('delete')
    ).length > 0;

  const onSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    // If there's an exisiting error, don't submit
    if (error) {
      return;
    }

    // Get the data from the form
    const formData = new FormData(e.currentTarget);
    const data = Object.fromEntries(formData) as TeamAction['request.create-team-invite']; // TODO: other type for files

    // Validate email
    try {
      emailSchema.parse(data.email);
    } catch (e) {
      setError('Invalid email');
      return;
    }

    // Submit the data
    submit(data, { method: 'POST', action, encType: 'application/json', navigate: false });

    // Reset the email input & focus it
    if (inputRef.current) {
      inputRef.current.value = '';
      inputRef.current.focus();
    }
  };

  // Manage focus if a delete is triggered
  useEffect(() => {
    if (deleteTriggered) {
      inputRef.current?.focus();
    }
  }, [deleteTriggered]);

  return (
    <form className={`flex flex-row items-start gap-2`} onSubmit={onSubmit}>
      <div className="flex flex-grow flex-col">
        <Input
          autoComplete="off"
          aria-label="Email"
          placeholder="Email"
          name="email"
          autoFocus
          ref={inputRef}
          onChange={(e) => {
            const email = e.target.value;
            if (disallowedEmails.includes(email)) {
              setError('Email exists in team');
            } else {
              setError('');
            }
          }}
        />
        {error && (
          <Type variant="formError" className="mt-1">
            {error}
          </Type>
        )}
      </div>

      <div className="flex-shrink-0">
        <Select defaultValue={roles[0]} name="role">
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {roles.map((role) => (
              <SelectItem key={role} value={role}>
                {getRoleLabel(role)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <input type="hidden" name="intent" value={intent} />
      <Button type="submit">Invite</Button>
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
        <Type variant="body2">
          {primary} {isLoggedInUser && ' (You)'}
        </Type>
        {secondary && (
          <Type variant="caption" className={hasError ? 'text-destructive' : 'text-muted-foreground'}>
            {secondary}
          </Type>
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
    value = fetcherJson.role;
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
                role: newValue,
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
      <Skeleton className={`h-6 w-6 rounded-full`} />
      <Skeleton className={`h-4 w-40 rounded-sm`} />
      <Skeleton className={`rounded- h-4 w-28 rounded-sm`} />
    </ListItem>
  );
}

function PublicLink({ uuid, publicLinkAccess }: { uuid: string; publicLinkAccess: PublicLinkAccess }) {
  const fetcher = useFetcher();
  const fetcherUrl = ROUTES.FILES_SHARE(uuid);

  // If we're updating, optimistically show the next value
  if (fetcher.state !== 'idle' && isJsonObject(fetcher.json)) {
    const data = fetcher.json as FileShareAction['request.update-public-link-access'];
    publicLinkAccess = data.public_link_access;
  }

  const setPublicLinkAccess = async (newValue: PublicLinkAccess) => {
    const data: FileShareAction['request.update-public-link-access'] = {
      intent: 'update-public-link-access',
      public_link_access: newValue,
    };
    fetcher.submit(data, {
      method: 'POST',
      action: fetcherUrl,
      encType: 'application/json',
    });
  };

  const optionsByValue: Record<PublicLinkAccess, string> = {
    NOT_SHARED: 'Cannot view',
    READONLY: 'Can view',
    EDIT: 'Can edit',
  };

  const activeOptionLabel = optionsByValue[publicLinkAccess];

  return (
    <ListItem>
      <div className="flex h-6 w-6 items-center justify-center">
        {publicLinkAccess === 'NOT_SHARED' ? <LockClosedIcon /> : <GlobeIcon />}
      </div>

      <div className={`flex flex-col`}>
        <Type variant="body2">Anyone with the link</Type>
        {fetcher.state === 'idle' && fetcher.data && !fetcher.data.ok && (
          <Type variant="caption" className="text-destructive">
            Failed to update
          </Type>
        )}
      </div>

      <Select
        value={publicLinkAccess}
        onValueChange={(value: PublicLinkAccess) => {
          setPublicLinkAccess(value);
        }}
      >
        <SelectTrigger className={`w-auto`}>
          <SelectValue>{activeOptionLabel}</SelectValue>
        </SelectTrigger>
        <SelectContent>
          {Object.entries(optionsByValue).map(([value, label]) => (
            <SelectItem value={value} key={value}>
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
