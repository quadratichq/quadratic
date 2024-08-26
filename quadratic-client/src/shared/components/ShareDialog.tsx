import { Action as FileShareAction } from '@/routes/api.files.$uuid.sharing';
import { TeamAction } from '@/routes/teams.$teamUuid';
import { ROUTES } from '@/shared/constants/routes';
import { CONTACT_URL } from '@/shared/constants/urls';
import { Button } from '@/shared/shadcn/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/shared/shadcn/ui/dialog';
import { Input } from '@/shared/shadcn/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
} from '@/shared/shadcn/ui/select';
import { Skeleton } from '@/shared/shadcn/ui/skeleton';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/shared/shadcn/ui/tooltip';
import { cn } from '@/shared/shadcn/utils';
import { isJsonObject } from '@/shared/utils/isJsonObject';
import { Avatar } from '@mui/material';
import {
  Cross2Icon,
  EnvelopeClosedIcon,
  ExclamationTriangleIcon,
  GlobeIcon,
  LockClosedIcon,
  PersonIcon,
} from '@radix-ui/react-icons';
import mixpanel from 'mixpanel-browser';
import {
  ApiTypes,
  PublicLinkAccess,
  TeamPermission,
  UserFileRole,
  UserFileRoleSchema,
  UserTeamRole,
  UserTeamRoleSchema,
  emailSchema,
} from 'quadratic-shared/typesAndSchemas';
import React, { Children, FormEvent, ReactNode, useEffect, useRef, useState } from 'react';
import { FetcherSubmitFunction, useFetcher, useFetchers, useSubmit } from 'react-router-dom';
import { AvatarWithLetters } from './AvatarWithLetters';
import { useGlobalSnackbar } from './GlobalSnackbarProvider';
import { Type } from './Type';

function getRoleLabel(role: UserTeamRole | UserFileRole) {
  // prettier-ignore
  return (
    role === 'OWNER' ? 'Owner' :
    role === 'EDITOR' ? 'Can edit' :
    role === 'VIEWER' ? 'Can view' :
    ''
  );
}

export function DialogBody({ children }: { children: ReactNode }) {
  return <div className={`flex flex-col gap-3`}>{children}</div>;
}

export function ShareTeamDialog({ data }: { data: ApiTypes['/v0/teams/:uuid.GET.response'] }) {
  const {
    userMakingRequest,
    users,
    invites,
    team: { uuid },
    license,
  } = data;
  const action = ROUTES.TEAM(uuid);
  const numberOfOwners = users.filter((user) => user.role === 'OWNER').length;

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

  // <Button
  //   variant="link"
  //   onClick={() => {
  //     apiClient.teams.billing.getPortalSessionUrl(uuid).then((data) => {
  //       window.location.href = data.url;
  //     });
  //   }}
  //   className="h-auto p-0 font-normal leading-4"
  // >
  //   Edit billing
  // </Button>

  return (
    <DialogBody>
      {userMakingRequest.teamPermissions.includes('TEAM_EDIT') && (
        <InviteForm
          action={action}
          intent="create-team-invite"
          disallowedEmails={exisitingTeamEmails}
          roles={[
            ...(userMakingRequest.teamRole === UserTeamRoleSchema.enum.OWNER ? [UserTeamRoleSchema.enum.OWNER] : []),
            UserTeamRoleSchema.enum.EDITOR,
            UserTeamRoleSchema.enum.VIEWER,
          ]}
          roleDefaultValue={UserTeamRoleSchema.enum.EDITOR}
        />
      )}

      {license.status === 'exceeded' && (
        <div className="relative rounded border border-red-400 bg-red-100 px-4 py-3 text-red-700" role="alert">
          <div>
            <strong className="font-bold">Over the user limit!</strong>
          </div>
          <span className="block sm:inline">
            You are over your user limit of {license.limits.seats}. Please contact Quadratic Support to increase your
            limit.
          </span>
        </div>
      )}

      {license.status === 'revoked' && (
        <div className="relative rounded border border-red-400 bg-red-100 px-4 py-3 text-red-700" role="alert">
          <div>
            <strong className="font-bold">License Revoked!</strong>
          </div>
          <span className="block sm:inline">Your license has been revoked. Please contact Quadratic Support.</span>
        </div>
      )}

      {users.map((user) => {
        const isLoggedInUser = userMakingRequest.id === user.id;
        const canDelete = isLoggedInUser
          ? canDeleteLoggedInUserInTeam({ role: user.role, numberOfOwners })
          : canDeleteUserInTeam({
              permissions: userMakingRequest.teamPermissions,
              loggedInUserRole: userMakingRequest.teamRole,
              userRole: user.role,
            });
        const roles = isLoggedInUser
          ? getAvailableRolesForLoggedInUserInTeam({ role: user.role, numberOfOwners })
          : getAvailableRolesForUserInTeam({ loggedInUserRole: userMakingRequest.teamRole, userRole: user.role });
        return (
          <ManageUser
            key={user.id}
            isLoggedInUser={isLoggedInUser}
            user={user}
            onUpdate={(submit, userId, role) => {
              const data: TeamAction['request.update-team-user'] = {
                intent: 'update-team-user',
                userId,
                role,
              };
              submit(data, {
                method: 'POST',
                action,
                encType: 'application/json',
              });
            }}
            onDelete={
              canDelete
                ? (submit, userId) => {
                    const data: TeamAction['request.delete-team-user'] = {
                      intent: 'delete-team-user',
                      userId,
                    };

                    submit(data, {
                      method: 'POST',
                      action,
                      encType: 'application/json',
                    });
                  }
                : undefined
            }
            roles={roles}
          />
        );
      })}
      {invites.map((invite) => (
        <ManageInvite
          key={invite.id}
          invite={invite}
          onDelete={
            userMakingRequest.teamPermissions.includes('TEAM_EDIT')
              ? (submit, inviteId) => {
                  const data: TeamAction['request.delete-team-invite'] = { intent: 'delete-team-invite', inviteId };
                  submit(data, {
                    method: 'POST',
                    action,
                    encType: 'application/json',
                  });
                }
              : undefined
          }
        />
      ))}
      {pendingInvites.map((invite, i) => (
        <ManageInvite key={i} invite={invite} />
      ))}
    </DialogBody>
  );
}

function ShareFileDialogBody({ uuid, data }: { uuid: string; data: ApiTypes['/v0/files/:uuid/sharing.GET.response'] }) {
  const {
    file: { publicLinkAccess },
    users,
    invites,
    userMakingRequest: { filePermissions, id: loggedInUserId },
    owner,
  } = data;
  const fetchers = useFetchers();
  const action = ROUTES.API.FILE_SHARING(uuid);
  const canEditFile = filePermissions.includes('FILE_EDIT');

  sortLoggedInUserFirst(users, loggedInUserId);

  const pendingInvites = fetchers
    .filter(
      (fetcher) =>
        isJsonObject(fetcher.json) && fetcher.json.intent === 'create-file-invite' && fetcher.state !== 'idle'
    )
    .map((fetcher, i) => {
      const { email, role } = fetcher.json as FileShareAction['request.create-file-invite'];
      return {
        id: i,
        email,
        role,
      };
    });

  const disallowedEmails: string[] = [
    ...(owner.type === 'user' ? [owner.email] : []),
    ...users.map((user) => user.email),
    ...invites.map((invite) => invite.email),
    ...pendingInvites.map((invite) => invite.email),
  ];

  const isTeamFile = owner.type === 'team';

  return (
    <>
      {filePermissions.includes('FILE_EDIT') && (
        <InviteForm
          action={action}
          intent="create-file-invite"
          disallowedEmails={disallowedEmails}
          roles={[UserFileRoleSchema.enum.EDITOR, UserFileRoleSchema.enum.VIEWER]}
        />
      )}

      {isTeamFile && (
        <ListItem className="py-1 text-muted-foreground">
          <div className="flex h-6 w-6 items-center justify-center">
            <PersonIcon className="-mr-[2px]" />
            <PersonIcon className="-ml-[2px]" />
          </div>
          <Type variant="body2">Everyone at {owner.name}</Type>
          <Type variant="body2" className="pr-4">
            Can access
          </Type>
        </ListItem>
      )}

      <ListItemPublicLink uuid={uuid} publicLinkAccess={publicLinkAccess} disabled={!canEditFile} />

      {owner.type === 'user' && (
        <ListItemUser
          isYou={owner.id === data.userMakingRequest.id}
          email={owner.email}
          name={owner.name}
          picture={owner.picture}
          action={<Type className="pr-4">Owner</Type>}
        />
      )}

      {users.map((user) => {
        const isLoggedInUser = user.id === loggedInUserId;
        const canDelete = isLoggedInUser ? true : canEditFile;

        return (
          <ManageUser
            key={user.id}
            publicLinkAccess={publicLinkAccess}
            isLoggedInUser={isLoggedInUser}
            user={user}
            roles={canEditFile ? ['EDITOR', 'VIEWER'] : ['VIEWER']}
            onDelete={
              canDelete
                ? (submit, userId) => {
                    const data: FileShareAction['request.delete-file-user'] = { intent: 'delete-file-user', userId };
                    submit(data, { method: 'POST', action, encType: 'application/json' });
                  }
                : undefined
            }
            onUpdate={
              canEditFile
                ? (submit, userId, role) => {
                    const data: FileShareAction['request.update-file-user'] = {
                      intent: 'update-file-user',
                      userId,
                      // @ts-expect-error fix type here because role
                      role,
                    };
                    submit(data, { method: 'POST', action, encType: 'application/json' });
                  }
                : undefined
            }
          />
        );
      })}
      {invites.map((invite) => (
        <ManageInvite
          key={invite.id}
          invite={invite}
          onDelete={
            filePermissions.includes('FILE_EDIT')
              ? (submit, inviteId) => {
                  const data: FileShareAction['request.delete-file-invite'] = {
                    intent: 'delete-file-invite',
                    inviteId,
                  };
                  submit(data, {
                    method: 'POST',
                    action,
                    encType: 'application/json',
                  });
                }
              : undefined
          }
        />
      ))}
      {pendingInvites.map((invite, i) => (
        <ManageInvite key={i} invite={invite} />
      ))}
    </>
  );
}

function CopyLinkButton({
  publicLinkAccess,
  isTeamFile,
  uuid,
}: {
  publicLinkAccess?: PublicLinkAccess;
  isTeamFile: boolean;
  uuid: string;
}) {
  const fetchers = useFetchers();
  const { addGlobalSnackbar } = useGlobalSnackbar();
  const publicLinkAccessFetcher = fetchers.find(
    (fetcher) =>
      isJsonObject(fetcher.json) && fetcher.json.intent === 'update-public-link-access' && fetcher.state !== 'idle'
  );
  const optimisticPublicLinkAccess = publicLinkAccessFetcher
    ? (publicLinkAccessFetcher.json as FileShareAction['request.update-public-link-access']).publicLinkAccess
    : publicLinkAccess;
  const url = window.location.origin + ROUTES.FILE(uuid);
  const disabled = publicLinkAccess ? (isTeamFile ? false : optimisticPublicLinkAccess === 'NOT_SHARED') : true;

  return (
    <>
      {/*
      // leaving this code here in case we decide to bring it back
      <Button
        variant={disabled ? 'ghost' : 'link'}
        disabled={disabled}
        className="flex-shrink-0"
        onClick={() => {
          mixpanel.track('[FileSharing].publicLinkAccess.clickCopyLink');
          navigator.clipboard
            .writeText(url + getShareUrlParams())
            .then(() => {
              addGlobalSnackbar('Copied link to clipboard.');
            })
            .catch(() => {
              addGlobalSnackbar('Failed to copy link to clipboard.', { severity: 'error' });
            });
        }}
      >
        Copy link with position
      </Button> */}
      <Button
        variant={disabled ? 'ghost' : 'link'}
        disabled={disabled}
        className="flex-shrink-0"
        onClick={() => {
          mixpanel.track('[FileSharing].publicLinkAccess.clickCopyLink');
          navigator.clipboard
            .writeText(url)
            .then(() => {
              addGlobalSnackbar('Copied link to clipboard.');
            })
            .catch(() => {
              addGlobalSnackbar('Failed to copy link to clipboard.', { severity: 'error' });
            });
        }}
      >
        Copy link
      </Button>
    </>
  );
}

export function ShareFileDialog({ uuid, name, onClose }: { uuid: string; name: string; onClose: () => void }) {
  const fetcher = useFetcher();

  const loadState = !fetcher.data ? 'LOADING' : !fetcher.data.ok ? 'FAILED' : 'LOADED';

  // On the initial mount, load the data (if it's not there already)
  useEffect(() => {
    if (fetcher.state === 'idle' && !fetcher.data) {
      fetcher.load(ROUTES.API.FILE_SHARING(uuid));
    }
  }, [fetcher, uuid]);

  const loaderData =
    loadState === 'LOADED' ? (fetcher.data.data as ApiTypes['/v0/files/:uuid/sharing.GET.response']) : undefined;

  return (
    <Dialog open={true} onOpenChange={onClose}>
      <DialogContent className="[&>button]:hidden">
        <DialogHeader>
          <div className={`-mb-1 -mt-2 flex flex-row items-center justify-between`}>
            <DialogTitle>Share file</DialogTitle>

            <div className="mt-0 flex items-center">
              <CopyLinkButton
                publicLinkAccess={loaderData?.file.publicLinkAccess}
                isTeamFile={loaderData?.owner.type === 'team'}
                uuid={uuid}
              />
              <Button
                variant={null}
                size="icon"
                onClick={onClose}
                className="opacity-70 transition-opacity hover:opacity-100"
              >
                <Cross2Icon />
              </Button>
            </div>
          </div>
        </DialogHeader>
        <DialogBody>
          {loadState === 'LOADING' && (
            <ListItem>
              <Skeleton className={`h-6 w-6 rounded-full`} />
              <Skeleton className={`h-4 w-40 rounded-sm`} />
              <Skeleton className={`rounded- h-4 w-28 rounded-sm`} />
            </ListItem>
          )}
          {loadState === 'FAILED' && (
            <div>
              <Type className="text-destructive">
                Failed to load,{' '}
                <button
                  className="underline"
                  onClick={() => {
                    fetcher.load(ROUTES.API.FILE_SHARING(uuid));
                  }}
                >
                  try again
                </button>
                . If the problem continues,{' '}
                <a href={CONTACT_URL} target="_blank" rel="noreferrer" className="underline">
                  contact us
                </a>
                .
              </Type>
            </div>
          )}
          {loadState === 'LOADED' && loaderData && <ShareFileDialogBody uuid={uuid} data={loaderData} />}
        </DialogBody>
      </DialogContent>
    </Dialog>
  );
}

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
  roleDefaultValue,
}: {
  disallowedEmails: string[];
  intent: TeamAction['request.create-team-invite']['intent'] | FileShareAction['request.create-file-invite']['intent'];
  action: string;
  roles: (UserTeamRole | UserFileRole)[];
  roleDefaultValue?: UserTeamRole | UserFileRole;
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

    // Get the data from the form
    const formData = new FormData(e.currentTarget);
    const emailFromUser = String(formData.get('email_search')).trim();
    const role = String(formData.get('role'));

    // Validate email
    let email;
    try {
      email = emailSchema.parse(emailFromUser);
    } catch (e) {
      setError('Invalid email.');
      return;
    }
    if (disallowedEmails.includes(email)) {
      setError('This email has already been invited.');
      return;
    }

    // Submit the data
    // TODO: (enhancement) enhance types so it knows which its submitting to
    submit({ intent, email: email, role }, { method: 'POST', action, encType: 'application/json', navigate: false });

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

  // Ensure the input gets focus when the dialog opens
  useEffect(() => {
    setTimeout(() => {
      inputRef.current?.focus();
    }, 100);
  }, []);

  return (
    <form className={`flex flex-row items-start gap-2`} onSubmit={onSubmit}>
      <div className="flex flex-grow flex-col">
        <Input
          autoComplete="off"
          spellCheck="false"
          aria-label="Email"
          placeholder="Email"
          // We have to put the `search` in the name because Safari
          // https://bytes.grubhub.com/disabling-safari-autofill-for-a-single-line-address-input-b83137b5b1c7
          name="email_search"
          autoFocus
          ref={inputRef}
          onChange={(e) => {
            setError('');
          }}
        />
        {error && (
          <Type variant="formError" className="mt-1">
            {error}
          </Type>
        )}
      </div>

      <div className="flex-shrink-0">
        <Select defaultValue={roleDefaultValue ? roleDefaultValue : roles[0]} name="role">
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {roles.map((role, i) => (
              <SelectItem key={role} value={role}>
                {getRoleLabel(role)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <Button
        type="submit"
        onClick={() => {
          inputRef.current?.focus();
        }}
      >
        Invite
      </Button>
    </form>
  );
}

function ManageUser({
  isLoggedInUser,
  publicLinkAccess,
  user,
  roles,
  onDelete,
  onUpdate,
}: {
  onDelete?: (submit: FetcherSubmitFunction, userId: string) => void;
  onUpdate?: (submit: FetcherSubmitFunction, userId: string, role: UserTeamRole | UserFileRole) => void;
  publicLinkAccess?: PublicLinkAccess;
  isLoggedInUser: boolean;
  user: {
    id: number;
    role: UserTeamRole | UserFileRole;
    email: string;
    name?: string;
    picture?: string;
  };
  roles: (UserTeamRole | UserFileRole)[];
}) {
  const fetcherDelete = useFetcher();
  const fetcherUpdate = useFetcher();

  const isReadOnly = !((roles.length > 2 && Boolean(onUpdate)) || Boolean(onDelete));
  const userId = String(user.id);
  let activeRole = user.role;
  let error = undefined;

  // If user is being deleted, hide them
  if (fetcherDelete.state !== 'idle') {
    return null;
    // If there was a failure to delete, show an error
  } else if (fetcherDelete.data && !fetcherDelete.data.ok) {
    error = 'Failed to delete. Try again.';
  }

  // If the user's role is being updated, show the optimistic value
  if (fetcherUpdate.state !== 'idle' && isJsonObject(fetcherUpdate.json)) {
    activeRole = fetcherUpdate.json.role as (typeof roles)[0];
  } else if (fetcherUpdate.data && !fetcherUpdate.data.ok) {
    error = 'Failed to update. Try again.';
  }

  const label = getRoleLabel(activeRole);

  return (
    <ListItemUser
      isYou={isLoggedInUser}
      email={user.email}
      name={user.name}
      picture={user.picture}
      error={error}
      action={
        isReadOnly ? (
          <Type className="pr-4">{label}</Type>
        ) : (
          <div className="flex items-center gap-4">
            {publicLinkAccess === 'EDIT' && activeRole === 'VIEWER' && (
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger>
                    <ExclamationTriangleIcon className="text-warning" />
                  </TooltipTrigger>
                  <TooltipContent className="max-w-40 text-center">
                    This person can still edit because the file is set so <em>anyone with the link can edit</em>.
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            )}
            <Select
              value={activeRole}
              onValueChange={(value: 'DELETE' | (typeof roles)[0]) => {
                if (value === 'DELETE' && onDelete) {
                  const msg = isLoggedInUser
                    ? 'Please confirm you want to leave this team. Your private files will be made public to the team.'
                    : 'Please confirm you want to remove this person from the team. Their private files will be made public to the team.';
                  const result = window.confirm(msg);
                  if (result) {
                    onDelete(fetcherDelete.submit, userId);
                  }
                } else if (onUpdate) {
                  const role = value as (typeof roles)[0];
                  onUpdate(fetcherUpdate.submit, userId, role);
                }
              }}
            >
              <SelectTrigger className={`w-auto`}>
                <SelectValue>{label}</SelectValue>
              </SelectTrigger>

              <SelectContent>
                {roles.map((role, i) => (
                  <SelectItem key={i} value={role}>
                    {getRoleLabel(role)}
                  </SelectItem>
                ))}
                <SelectSeparator />
                <SelectItem value="DELETE">{isLoggedInUser ? 'Leave' : 'Remove'}</SelectItem>
              </SelectContent>
            </Select>
          </div>
        )
      }
    />
  );
}

/**
 * Displaying an invite in the UI. If the invite can be deleted, pass a function
 * to handle the delete.
 */
function ManageInvite({
  invite,
  onDelete,
}: {
  onDelete?: (submit: FetcherSubmitFunction, inviteId: string) => void;
  invite: {
    role: UserTeamRole | UserFileRole;
    id: number;
    email: string;
  };
}) {
  const deleteFetcher = useFetcher();

  const { email, role, id } = invite;
  const inviteId = String(id);
  const disabled = !Boolean(onDelete);
  const hasError = deleteFetcher.state === 'idle' && deleteFetcher.data && !deleteFetcher.data.ok;
  const label = getRoleLabel(role);

  // If we're not idle, we're deleting
  if (deleteFetcher.state !== 'idle') {
    return null;
  }

  // TODO: resend email functionality

  return (
    <ListItemInvite
      email={email}
      error={hasError ? 'Failed to delete, try again' : undefined}
      action={
        disabled ? (
          <Type className="pr-4">{label}</Type>
        ) : (
          <Select
            disabled={disabled}
            value={role}
            onValueChange={(value: string) => {
              if (value === 'DELETE' && onDelete) {
                onDelete(deleteFetcher.submit, inviteId);
              }
            }}
          >
            <SelectTrigger className={`w-auto`}>
              <SelectValue>{label}</SelectValue>
            </SelectTrigger>

            <SelectContent>
              <SelectItem value={role}>{label}</SelectItem>

              {onDelete && (
                <>
                  <SelectSeparator />
                  <SelectItem value={'DELETE'}>Remove</SelectItem>
                </>
              )}
            </SelectContent>
          </Select>
        )
      }
    />
  );
}

function ListItemInvite({ email, action, error }: { email: string; action: ReactNode; error?: string }) {
  return (
    <ListItem>
      <div>
        <Avatar sx={{ width: '24px', height: '24px' }}>
          <EnvelopeClosedIcon />
        </Avatar>
      </div>
      <div className={`flex flex-col`}>
        <Type variant="body2">{email}</Type>

        <Type variant="caption" className={error ? 'text-destructive' : 'text-muted-foreground'}>
          {error ? error : 'Invited'}
        </Type>
      </div>
      <div>{action}</div>
    </ListItem>
  );
}

function ListItemUser({
  name,
  email,
  picture,
  action,
  error,
  isYou,
}: {
  name?: string;
  email: string;
  picture?: string;
  action: ReactNode;
  error?: string;
  isYou: boolean;
}) {
  let label = name ? name : email;
  const secondary = error ? error : name ? email : '';
  return (
    <ListItem>
      <div>
        <AvatarWithLetters src={picture} size="small">
          {label}
        </AvatarWithLetters>
      </div>
      <div className={`flex flex-col`}>
        <Type variant="body2">
          {label} {isYou && ' (You)'}
        </Type>
        {secondary && (
          <Type variant="caption" className={error ? 'text-destructive' : 'text-muted-foreground'}>
            {secondary}
          </Type>
        )}
      </div>

      <div>{action}</div>
    </ListItem>
  );
}

function ListItemPublicLink({
  uuid,
  publicLinkAccess,
  disabled,
}: {
  uuid: string;
  publicLinkAccess: PublicLinkAccess;
  disabled: boolean;
}) {
  const fetcher = useFetcher();
  const fetcherUrl = ROUTES.API.FILE_SHARING(uuid);

  // If we're updating, optimistically show the next value
  if (fetcher.state !== 'idle' && isJsonObject(fetcher.json)) {
    const data = fetcher.json as FileShareAction['request.update-public-link-access'];
    publicLinkAccess = data.publicLinkAccess;
  }

  const setPublicLinkAccess = async (newValue: PublicLinkAccess) => {
    const data: FileShareAction['request.update-public-link-access'] = {
      intent: 'update-public-link-access',
      publicLinkAccess: newValue,
    };
    fetcher.submit(data, {
      method: 'POST',
      action: fetcherUrl,
      encType: 'application/json',
    });
  };

  const optionsByValue: Record<PublicLinkAccess, string> = {
    NOT_SHARED: 'No access',
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

      <div className="flex items-center gap-1">
        {disabled ? (
          <Type className="pr-4">{activeOptionLabel}</Type>
        ) : (
          <Select
            disabled={disabled}
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
        )}
      </div>
    </ListItem>
  );
}

function ListItem({ className, children }: { className?: string; children: React.ReactNode }) {
  if (Children.count(children) !== 3) {
    console.warn('<ListItem> expects exactly 3 children');
  }

  return <div className={cn(className, 'flex flex-row items-center gap-3 [&>:nth-child(3)]:ml-auto')}>{children}</div>;
}

// TODO: write tests for these
function canDeleteLoggedInUserInTeam({ role, numberOfOwners }: { role: UserTeamRole; numberOfOwners: number }) {
  if (role === 'OWNER') {
    if (numberOfOwners < 2) {
      return false;
    }
  }
  return true;
}
function canDeleteUserInTeam({
  permissions,
  loggedInUserRole,
  userRole,
}: {
  permissions: TeamPermission[];
  loggedInUserRole: UserTeamRole;
  userRole: UserTeamRole;
}) {
  const { OWNER, EDITOR } = UserTeamRoleSchema.enum;
  if (permissions.includes('TEAM_EDIT')) {
    // If you're an editor, you can't remove an owner
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
  role: UserTeamRole;
  numberOfOwners: number;
}) {
  const { OWNER, EDITOR, VIEWER } = UserTeamRoleSchema.enum;

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
  loggedInUserRole: UserTeamRole;
  userRole: UserTeamRole;
}) {
  const { OWNER, EDITOR, VIEWER } = UserTeamRoleSchema.enum;

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

export function sortLoggedInUserFirst(collection: { id: number }[], loggedInUserId: number) {
  collection.sort((a, b) => {
    // Move the logged in user to the front
    if (a.id === loggedInUserId && b.id !== loggedInUserId) return -1;
    // Keep the logged in user at the front
    if (a.id !== loggedInUserId && b.id === loggedInUserId) return 1;
    // Leave the order as is for others
    return 0;
  });
}
