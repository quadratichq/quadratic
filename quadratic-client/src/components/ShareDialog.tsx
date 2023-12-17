import { ROUTES } from '@/constants/routes';
import { Action as FileShareAction } from '@/routes/files.$uuid.sharing';
import { TeamAction } from '@/routes/teams.$teamUuid';
import { Button } from '@/shadcn/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/shadcn/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/shadcn/ui/dropdown-menu';
import { Input } from '@/shadcn/ui/input';
import { Select, SelectContent, SelectItem, SelectSeparator, SelectTrigger, SelectValue } from '@/shadcn/ui/select';
import { Skeleton } from '@/shadcn/ui/skeleton';
import { isJsonObject } from '@/utils/isJsonObject';
import { Avatar } from '@mui/material';
import { CaretDownIcon, EnvelopeClosedIcon, GlobeIcon, LockClosedIcon } from '@radix-ui/react-icons';
import {
  Access,
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
  const action = `/teams/${uuid}`;
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
  const exisitingTeamEmails: string[] = [
    ...users.map((user) => user.email),
    ...invites.map((invite) => invite.email),
    ...pendingInvites.map((invite) => invite.email),
  ];

  return (
    <ShareDialog title={`Share ${name}`} description="Invite people to collaborate in this team" onClose={onClose}>
      {loggedInUser.access.includes('TEAM_EDIT') && (
        <InviteForm
          action={action}
          intent="create-team-invite"
          disallowedEmails={exisitingTeamEmails}
          roles={[UserRoleTeamSchema.enum.EDITOR, UserRoleTeamSchema.enum.VIEWER]}
        />
      )}

      {sortedUsers.map((user, i) => {
        const isLoggedInUser = i === 0;
        const canDelete = isLoggedInUser
          ? canDeleteLoggedInUserInTeam({ role: user.role, numberOfOwners })
          : canDeleteUserInTeam({
              access: loggedInUser.access,
              loggedInUserRole: loggedInUser.role,
              userRole: user.role,
            });
        const roles = isLoggedInUser
          ? getAvailableRolesForLoggedInUserInTeam({ role: user.role, numberOfOwners })
          : getAvailableRolesForUserInTeam({ loggedInUserRole: loggedInUser.role, userRole: user.role });
        return (
          <ManageUser
            key={user.id}
            action={action}
            isLoggedInUser={isLoggedInUser}
            user={user}
            canDelete={canDelete}
            roles={roles}
          />
        );
      })}
      {invites.map((invite) => (
        <ManageInvite key={invite.id} invite={invite} loggedInUser={loggedInUser} />
      ))}
      {pendingInvites.map((invite, i) => (
        <ManageInvite key={i} invite={invite} loggedInUser={loggedInUser} disabled={true} />
      ))}
    </ShareDialog>
  );
}

function ShareFileDialogBody({ uuid, data }: { uuid: string; data: ApiTypes['/v0/files/:uuid/sharing.GET.response'] }) {
  const { public_link_access } = data;
  return (
    <>
      <InviteForm
        action={`/files/${uuid}/sharing`}
        // @ts-expect-error
        intent=""
        disallowedEmails={[]}
        roles={[UserRoleFileSchema.enum.EDITOR, UserRoleFileSchema.enum.VIEWER]}
      />
      <PublicLink uuid={uuid} publicLinkAccess={public_link_access} />
    </>
  );
}

export function ShareFileDialog({ uuid, name, onClose, fetcherUrl }: any) {
  const fetcher = useFetcher();
  const isLoading = !fetcher.data;
  const failedToLoad = fetcher.state === 'idle' && fetcher.data && !fetcher.data.ok;

  // On the initial mount, load the data (if it's not there already)
  useEffect(() => {
    if (fetcher.state === 'idle' && !fetcher.data) {
      fetcher.load(ROUTES.FILES_SHARE(uuid));
    }
  }, [fetcher, uuid]);

  return (
    <ShareDialog title={`Share ${name}`} description="Invite people to collaborate on this file" onClose={onClose}>
      {failedToLoad ? (
        <div>TODO: Failed to load</div>
      ) : isLoading ? (
        <ListItem>
          <Skeleton className={`h-6 w-6 rounded-full`} />
          <Skeleton className={`h-4 w-40 rounded-sm`} />
          <Skeleton className={`rounded- h-4 w-28 rounded-sm`} />
        </ListItem>
      ) : (
        <ShareFileDialogBody uuid={uuid} data={fetcher.data.data} />
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

/**
 * Form that accepts an email and a role and invites the person to a team or file
 *
 * TODO:(enhancement) allow inviting owners, which requires backend support
 */
export function InviteForm({
  disallowedEmails,
  action,
  intent,
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

function ManageUser({
  action,
  isLoggedInUser,
  user,
  roles,
  canDelete,
}: {
  action: string;
  canDelete: boolean;
  isLoggedInUser: boolean;
  user: ApiTypes['/v0/teams/:uuid.GET.response']['team']['users'][0];
  roles: (UserRoleTeam | UserRoleFile)[];
}) {
  const fetcher = useFetcher();

  const disabled = roles.length === 1 && !canDelete;
  const userId = String(user.id);
  const primary = (user.name ? user.name : user.email) + (isLoggedInUser ? ' (You)' : '');
  let secondary = user.name ? user.email : '';
  let value = user.role;
  let hasError = false;

  // If user is being deleted, hide them
  if (fetcher.state !== 'idle' && isJsonObject(fetcher.json) && fetcher.json.intent === 'delete-team-user') {
    return null;
  }

  // If the user's role is being updated, show the optimistic value
  if (fetcher.state !== 'idle' && isJsonObject(fetcher.json) && fetcher.json.intent === 'update-team-user') {
    // @ts-expect-error TODO: fix type here
    value = fetcher.json.role;
  }

  // If there was an error, show it
  if (fetcher.state !== 'submitting' && fetcher.data && !fetcher.data.ok) {
    hasError = true;
    secondary = 'Failed to update. Try again.';
  }

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
        <DropdownMenu>
          <DropdownMenuTrigger asChild disabled={false || disabled}>
            <Button variant="outline" className="px-3 font-normal hover:bg-inherit">
              {getRoleLabel(value)} <CaretDownIcon className="ml-0 text-muted-foreground" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent>
            <DropdownMenuRadioGroup
              value={value}
              onValueChange={(newValue: string) => {
                const data: TeamAction['request.update-team-user'] = {
                  intent: 'update-team-user',
                  userId,
                  // @ts-expect-error
                  role: newValue,
                };

                fetcher.submit(data, {
                  method: 'POST',
                  action,
                  encType: 'application/json',
                });
              }}
            >
              {roles.map((role, i) => (
                <DropdownMenuRadioItem key={i} value={role}>
                  {getRoleLabel(role)}
                </DropdownMenuRadioItem>
              ))}
            </DropdownMenuRadioGroup>

            {canDelete && (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={() => {
                    const data: TeamAction['request.delete-team-user'] = {
                      intent: 'delete-team-user',
                      userId,
                    };

                    fetcher.submit(data, {
                      method: 'POST',
                      action,
                      encType: 'application/json',
                    });
                  }}
                >
                  {isLoggedInUser ? 'Leave' : 'Remove'}
                </DropdownMenuItem>
              </>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      }
    />
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
          <SelectTrigger disabled={disabled || !loggedInUser.access.includes('TEAM_EDIT')}>
            {getRoleLabel(role)}
          </SelectTrigger>
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

function ListItem({ children }: { children: React.ReactNode }) {
  if (Children.count(children) !== 3) {
    console.warn('<ListItem> expects exactly 3 children');
  }

  return <div className={'flex flex-row items-center gap-3 [&>:nth-child(3)]:ml-auto'}>{children}</div>;
}

// TODO: write tests for these
function canDeleteLoggedInUserInTeam({ role, numberOfOwners }: { role: UserRoleTeam; numberOfOwners: number }) {
  if (role === 'OWNER') {
    if (numberOfOwners < 2) {
      return false;
    }
  }

  return true;
}
function canDeleteUserInTeam({
  access,
  loggedInUserRole,
  userRole,
}: {
  access: Access[];
  loggedInUserRole: UserRoleTeam;
  userRole: UserRoleTeam;
}) {
  // TODO: can a user who is an editor remove a member who has a higher role than themselves?
  const { OWNER, EDITOR } = UserRoleTeamSchema.enum;
  if (access.includes('TEAM_EDIT')) {
    if (loggedInUserRole === EDITOR && userRole === OWNER) {
      return false;
    }
    return true;
  }

  return false;
}

function getAvailableRolesForLoggedInUserInTeam({
  role,
  numberOfOwners,
}: {
  role: UserRoleTeam;
  numberOfOwners: number;
}) {
  const { OWNER, EDITOR, VIEWER } = UserRoleTeamSchema.enum;

  if (role === OWNER) {
    if (numberOfOwners > 1) {
      return [OWNER, EDITOR, VIEWER];
    } else {
      return [OWNER];
    }
  }

  if (role === EDITOR) {
    return [EDITOR, VIEWER];
  }

  return [VIEWER];
}

function getAvailableRolesForUserInTeam({
  loggedInUserRole,
  userRole,
}: {
  loggedInUserRole: UserRoleTeam;
  userRole: UserRoleTeam;
}) {
  const { OWNER, EDITOR, VIEWER } = UserRoleTeamSchema.enum;

  if (loggedInUserRole === OWNER) {
    return [OWNER, EDITOR, VIEWER];
  }

  if (loggedInUserRole === EDITOR) {
    if (userRole === OWNER) {
      return [OWNER];
    } else {
      return [EDITOR, VIEWER];
    }
  }

  if (loggedInUserRole === VIEWER) {
    if (userRole === OWNER) {
      return [OWNER];
    } else if (userRole === EDITOR) {
      return [EDITOR];
    } else {
      return [VIEWER];
    }
  }

  console.error('Unexpected code path reached');
  return [VIEWER];
}
