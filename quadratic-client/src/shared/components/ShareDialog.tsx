import { getActionFileMove, type Action as FileAction } from '@/routes/api.files.$uuid';
import type { Action as FileShareAction, FilesSharingLoader } from '@/routes/api.files.$uuid.sharing';
import type { TeamAction } from '@/routes/teams.$teamUuid';
import { syncFileLocation } from '@/shared/atom/fileLocationAtom';
import { Avatar } from '@/shared/components/Avatar';
import { useConfirmDialog } from '@/shared/components/ConfirmProvider';
import { useGlobalSnackbar } from '@/shared/components/GlobalSnackbarProvider';
import { GroupAddIcon, GroupIcon, GroupOffIcon, MailIcon, PublicIcon, PublicOffIcon } from '@/shared/components/Icons';
import { Type } from '@/shared/components/Type';
import { ROUTES } from '@/shared/constants/routes';
import { CONTACT_URL } from '@/shared/constants/urls';
import { useTeamData } from '@/shared/hooks/useTeamData';
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
import { Tooltip, TooltipContent, TooltipTrigger } from '@/shared/shadcn/ui/tooltip';
import { cn } from '@/shared/shadcn/utils';
import { trackEvent } from '@/shared/utils/analyticsEvents';
import { isJsonObject } from '@/shared/utils/isJsonObject';
import { Cross2Icon, ExclamationTriangleIcon } from '@radix-ui/react-icons';
import type {
  ApiTypes,
  PublicLinkAccess,
  TeamPermission,
  UserFileRole,
  UserTeamRole,
} from 'quadratic-shared/typesAndSchemas';
import { UserFileRoleSchema, UserTeamRoleSchema, emailSchema } from 'quadratic-shared/typesAndSchemas';
import type { FormEvent, ReactNode } from 'react';
import React, { Children, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { FetcherSubmitFunction } from 'react-router';
import { useFetcher, useFetchers, useSubmit } from 'react-router';

type UserMakingRequest = ApiTypes['/v0/teams/:uuid.GET.response']['userMakingRequest'];
type ShareUser = {
  id: number;
  role: UserTeamRole | UserFileRole;
  email: string;
  name?: string;
  picture?: string;
};

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

export function ShareTeamDialog() {
  const { teamData, isLoading } = useTeamData();
  const data = teamData?.activeTeam;
  const fetchers = useFetchers();

  // Extract data with useMemo to avoid dependency issues
  const users = useMemo(() => data?.users ?? [], [data?.users]);
  const invites = useMemo(() => data?.invites ?? [], [data?.invites]);
  const uuid = useMemo(() => data?.team?.uuid ?? '', [data?.team?.uuid]);
  const userMakingRequest = data?.userMakingRequest;
  const license = data?.license;

  // All hooks must be called before any conditional returns
  const action = useMemo(() => (uuid ? ROUTES.TEAM(uuid) : ''), [uuid]);
  const numberOfOwners = useMemo(() => users.filter((user) => user.role === 'OWNER').length, [users]);

  const pendingInvites = useMemo(() => {
    const inviteEmails = new Set(invites.map((inv) => inv.email));
    const userEmails = new Set(users.map((user) => user.email));

    return (
      fetchers
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
        })
        // Filter out invites that are already in the invites list (from useTeamData optimistic updates)
        // or that match existing users (when inviting existing users, they're immediately added as users)
        .filter((invite) => !inviteEmails.has(invite.email) && !userEmails.has(invite.email))
    );
  }, [fetchers, invites, users]);

  // Get all emails of users and pending invites so user can't input them
  const existingTeamEmails: string[] = useMemo(
    () => [
      ...users.map((user) => user.email),
      ...invites.map((invite) => invite.email),
      ...pendingInvites.map((invite) => invite.email),
    ],
    [invites, pendingInvites, users]
  );

  // Now we can do conditional returns after all hooks
  if (isLoading || !data || !userMakingRequest || !license) {
    return (
      <DialogBody>
        <ListItem>
          <Skeleton className={`h-6 w-6 rounded-full`} />
          <Skeleton className={`h-4 w-40 rounded-sm`} />
          <Skeleton className={`rounded- h-4 w-28 rounded-sm`} />
        </ListItem>
      </DialogBody>
    );
  }

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
          disallowedEmails={existingTeamEmails}
          roles={[
            ...(userMakingRequest.teamRole === UserTeamRoleSchema.enum.OWNER ? [UserTeamRoleSchema.enum.OWNER] : []),
            UserTeamRoleSchema.enum.EDITOR,
            UserTeamRoleSchema.enum.VIEWER,
          ]}
          roleDefaultValue={UserTeamRoleSchema.enum.EDITOR}
        />
      )}

      {license.status === 'exceeded' && (
        <div className="relative rounded border border-red-400 bg-red-100 px-4 py-3 text-sm text-red-700" role="alert">
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
        <div className="relative rounded border border-red-400 bg-red-100 px-4 py-3 text-sm text-red-700" role="alert">
          <div>
            <strong className="font-bold">License Revoked!</strong>
          </div>
          <span className="block sm:inline">Your license has been revoked. Please contact Quadratic Support.</span>
        </div>
      )}

      {users.map((user) => (
        <ManageTeamUser
          key={user.id}
          user={user}
          userMakingRequest={userMakingRequest}
          numberOfOwners={numberOfOwners}
          action={action}
        />
      ))}

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

function ManageTeamUser({
  action,
  numberOfOwners,
  user,
  userMakingRequest,
}: {
  action: string;
  numberOfOwners: number;
  user: ShareUser;
  userMakingRequest: UserMakingRequest;
}) {
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
  const confirmFn = useConfirmDialog('deleteUserFromTeam', { name: user.name ?? user.email, isLoggedInUser });
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
          ? async (submit, userId) => {
              if (await confirmFn()) {
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
            }
          : undefined
      }
      roles={roles}
    />
  );
}

function ShareFileDialogBody({
  uuid,
  data,
  upgradeMember,
  setUpgradeMember,
}: {
  uuid: string;
  data: ApiTypes['/v0/files/:uuid/sharing.GET.response'];
  upgradeMember: UpgradeMember;
  setUpgradeMember: SetUpgradeMember;
}) {
  const {
    file: { publicLinkAccess },
    team: { uuid: teamUuid, name: teamName },
    users,
    invites,
    userMakingRequest: { filePermissions, id: loggedInUserId, teamRole },
    owner,
  } = data;
  const fetchers = useFetchers();
  const action = useMemo(() => ROUTES.API.FILE_SHARING(uuid), [uuid]);
  const canEditFile = useMemo(() => filePermissions.includes('FILE_EDIT'), [filePermissions]);

  sortLoggedInUserFirst(users, loggedInUserId);

  const pendingInvites = useMemo(
    () =>
      fetchers
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
        }),
    [fetchers]
  );

  const teamMemberEmails = useMemo(
    () => [
      ...users.filter((user) => user.isTeamMember).map((user) => user.email),
      ...invites.filter((invite) => invite.isTeamMember).map((invite) => invite.email),
    ],
    [users, invites]
  );

  const disallowedEmails: string[] = useMemo(
    () => [
      ...(owner.type === 'user' ? [owner.email] : []),
      ...users.map((user) => user.email),
      ...invites.map((invite) => invite.email),
      ...pendingInvites.map((invite) => invite.email),
    ],
    [invites, owner, pendingInvites, users]
  );

  const hasPermissionToUpgradeToTeamMember = useMemo(
    () => data.userMakingRequest.teamRole === 'OWNER' || data.userMakingRequest.teamRole === 'EDITOR',
    [data.userMakingRequest.teamRole]
  );

  return (
    <>
      {filePermissions.includes('FILE_EDIT') && (
        <InviteForm
          action={action}
          intent="create-file-invite"
          disallowedEmails={disallowedEmails}
          roles={[UserFileRoleSchema.enum.EDITOR, UserFileRoleSchema.enum.VIEWER]}
          setUpgradeMember={setUpgradeMember}
        />
      )}

      <ListItemPublicLink uuid={uuid} publicLinkAccess={publicLinkAccess} disabled={!canEditFile} />

      {teamRole && (
        <ListItemTeamFile
          teamName={teamName}
          ownerId={owner.type === 'user' ? owner.id : null}
          uuid={uuid}
          loggedInUserId={loggedInUserId}
          disabled={!filePermissions.includes('FILE_MOVE')}
        />
      )}

      {users.map((user) => (
        <ManageMemberUpgradeWrapper
          key={user.email}
          email={user.email}
          upgradeMember={upgradeMember}
          setUpgradeMember={setUpgradeMember}
          teamUuid={teamUuid}
          hasPermissionToUpgradeToTeamMember={hasPermissionToUpgradeToTeamMember}
          isInvite={false}
        >
          <ManageFileUser
            publicLinkAccess={publicLinkAccess}
            loggedInUserId={loggedInUserId}
            user={user}
            canEditFile={canEditFile}
            action={action}
            onAddToTeam={
              hasPermissionToUpgradeToTeamMember && !teamMemberEmails.includes(user.email)
                ? () => {
                    setUpgradeMember({ email: user.email, role: user.role, showUpgrade: true });
                  }
                : undefined
            }
          />
        </ManageMemberUpgradeWrapper>
      ))}

      {invites.map((invite) => (
        <ManageMemberUpgradeWrapper
          key={invite.email}
          setUpgradeMember={setUpgradeMember}
          upgradeMember={upgradeMember}
          email={invite.email}
          teamUuid={teamUuid}
          hasPermissionToUpgradeToTeamMember={hasPermissionToUpgradeToTeamMember}
          isInvite={true}
        >
          <ManageInvite
            invite={invite}
            onAddToTeam={
              hasPermissionToUpgradeToTeamMember && !teamMemberEmails.includes(invite.email)
                ? () => setUpgradeMember({ email: invite.email, role: invite.role, showUpgrade: true })
                : undefined
            }
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
        </ManageMemberUpgradeWrapper>
      ))}

      {pendingInvites.map((invite, i) => (
        <ManageInvite key={i} invite={invite} />
      ))}
    </>
  );
}

function ManageMemberUpgradeWrapper({
  children,
  email,
  upgradeMember,
  setUpgradeMember,
  teamUuid,
  hasPermissionToUpgradeToTeamMember,
  isInvite,
}: {
  children: ReactNode;
  email: string;
  upgradeMember: UpgradeMember;
  setUpgradeMember: SetUpgradeMember;
  teamUuid: string;
  hasPermissionToUpgradeToTeamMember: boolean;
  isInvite: boolean;
}) {
  const { addGlobalSnackbar } = useGlobalSnackbar();
  const wrapInUpgrade = upgradeMember && upgradeMember.showUpgrade === true && upgradeMember.email === email;
  const submit = useSubmit();
  const handleUpgrade = useCallback(() => {
    trackEvent('[FileSharing].inviteToTeam.upgrade');

    // Should never happen, since the component won't render, but to get the types
    // inferred correctly, we'll check for it.
    if (!upgradeMember) return;

    // Fire off the action
    const data: TeamAction['request.create-team-invite'] = {
      intent: 'create-team-invite',
      email: upgradeMember.email,
      role: upgradeMember.role,
    };
    submit(data, { method: 'POST', action: ROUTES.TEAM(teamUuid), encType: 'application/json', navigate: false });

    // Reset the upgrade member
    setUpgradeMember(null);

    // Trigger a toast
    addGlobalSnackbar(isInvite ? 'Invited to team.' : 'Added to team.');
  }, [upgradeMember, setUpgradeMember, submit, teamUuid, addGlobalSnackbar, isInvite]);

  const handleCancel = useCallback(() => {
    trackEvent('[FileSharing].inviteToTeam.cancel');
    setUpgradeMember(null);
  }, [setUpgradeMember]);

  if (!hasPermissionToUpgradeToTeamMember || !wrapInUpgrade) {
    return children;
  }

  return (
    <div className="-mx-3 -my-1.5 flex flex-col gap-1.5 rounded-md bg-accent px-3 py-1.5">
      {children}
      <div className="flex flex-col gap-2 rounded-md bg-accent py-1.5 text-sm">
        <p>
          <strong className="text-md font-semibold">Upgrade to team member?</strong> They’ll get access to this file as
          well as other team files. On Pro plans, they’ll also get access to paid features like increased AI usage.
        </p>
        <p className="flex items-center gap-2 italic">
          <GroupAddIcon />
          Reminder: team members are billed per seat on Pro plans.
        </p>
        <div className="mt-2 flex gap-2">
          <Button onClick={handleUpgrade}>Upgrade to team member</Button>
          <Button variant="outline" onClick={handleCancel}>
            Not now
          </Button>
        </div>
      </div>
    </div>
  );
}

function ManageFileUser({
  user,
  loggedInUserId,
  canEditFile,
  action,
  publicLinkAccess,
  onAddToTeam,
}: {
  user: ShareUser;
  loggedInUserId: number;
  canEditFile: boolean;
  action: string;
  publicLinkAccess: PublicLinkAccess;
  onAddToTeam?: () => void;
}) {
  const isLoggedInUser = user.id === loggedInUserId;
  const canDelete = isLoggedInUser ? true : canEditFile;
  const confirmFn = useConfirmDialog('deleteUserFromFile', { name: user.name ?? user.email, isLoggedInUser });

  return (
    <ManageUser
      key={user.id}
      publicLinkAccess={publicLinkAccess}
      isLoggedInUser={isLoggedInUser}
      user={user}
      roles={canEditFile ? ['EDITOR', 'VIEWER'] : ['VIEWER']}
      onAddToTeam={onAddToTeam}
      onDelete={
        canDelete
          ? async (submit, userId) => {
              if (await confirmFn()) {
                const data: FileShareAction['request.delete-file-user'] = { intent: 'delete-file-user', userId };
                submit(data, { method: 'POST', action, encType: 'application/json' });
              }
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
  const { addGlobalSnackbar } = useGlobalSnackbar();

  return (
    <>
      {/*
      // leaving this code here in case we decide to bring it back
      <Button
        variant={disabled ? 'ghost' : 'link'}
        disabled={disabled}
        className="flex-shrink-0"
        onClick={() => {
          trackEvent('[FileSharing].publicLinkAccess.clickCopyLink');
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
        variant={'link'}
        className="flex-shrink-0"
        onClick={() => {
          trackEvent('[FileSharing].publicLinkAccess.clickCopyLink');

          // Copy the base file URL (which DOES NOT include the current sheet ID)
          // Can't copy the current location because this can be used on the dashboard
          const url = window.location.origin + ROUTES.FILE({ uuid, searchParams: '' });

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

type UpgradeMember = { email: string; role: UserFileRole; showUpgrade?: boolean } | null;
type SetUpgradeMember = React.Dispatch<React.SetStateAction<UpgradeMember>>;

export function ShareFileDialog({ uuid, name, onClose }: { uuid: string; name: string; onClose: () => void }) {
  const fetcher = useFetcher<FilesSharingLoader>();
  const loadState = useMemo(() => (!fetcher.data ? 'LOADING' : !fetcher.data.ok ? 'FAILED' : 'LOADED'), [fetcher]);

  // On the initial mount, load the data (if it's not there already)
  useEffect(() => {
    if (fetcher.state === 'idle' && !fetcher.data) {
      fetcher.load(ROUTES.API.FILE_SHARING(uuid));
    }
  }, [fetcher, uuid]);

  // When the data is refreshed, check if we want to show the upgrade member dialog
  const [upgradeMember, setUpgradeMember] = useState<UpgradeMember>(null);
  useEffect(() => {
    if (fetcher.state === 'idle' && fetcher.data && fetcher.data.data) {
      // Get list of people who aren't already team members and only show the
      // upgrade UI if they aren't already members in the team
      const potentialUpgradeEmails = [
        ...fetcher.data.data.users.filter((user) => !user.isTeamMember).map((user) => user.email),
        ...fetcher.data.data.invites.filter((invite) => !invite.isTeamMember).map((invite) => invite.email),
      ];
      if (upgradeMember && upgradeMember.showUpgrade !== true && potentialUpgradeEmails.includes(upgradeMember.email)) {
        setUpgradeMember((prev) => (prev ? { ...prev, showUpgrade: true } : null));
      }
    }
  }, [fetcher, upgradeMember]);

  const loaderData = useMemo(() => {
    return loadState === 'LOADED' ? fetcher.data?.data : undefined;
  }, [loadState, fetcher.data]);

  return (
    <Dialog open={true} onOpenChange={onClose}>
      <DialogContent className="[&>button]:hidden" aria-describedby={undefined}>
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
          {loadState === 'LOADED' && loaderData && (
            <ShareFileDialogBody
              uuid={uuid}
              data={loaderData}
              setUpgradeMember={setUpgradeMember}
              upgradeMember={upgradeMember}
            />
          )}
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
  setUpgradeMember,
}: {
  disallowedEmails: string[];
  intent: TeamAction['request.create-team-invite']['intent'] | FileShareAction['request.create-file-invite']['intent'];
  action: string;
  roles: (UserTeamRole | UserFileRole)[];
  roleDefaultValue?: UserTeamRole | UserFileRole;
  setUpgradeMember?: SetUpgradeMember;
}) {
  const [error, setError] = useState<string>('');
  const inputRef = useRef<HTMLInputElement>(null);
  const submit = useSubmit();
  const fetchers = useFetchers();
  const deleteTriggered = useMemo(
    () =>
      fetchers.filter(
        (fetcher) =>
          fetcher.state === 'submitting' &&
          isJsonObject(fetcher.json) &&
          typeof fetcher.json.intent === 'string' &&
          fetcher.json.intent.includes('delete')
      ).length > 0,
    [fetchers]
  );

  const onSubmit = useCallback(
    (e: FormEvent<HTMLFormElement>) => {
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

      // Handle (optionally) upgrading the invite to a team member
      // We use `as` here because we won't know the type since this is used
      // for file and team invites (but we won't pass this function in a team context)
      setUpgradeMember?.({ email, role: role as UserFileRole });
    },
    [action, disallowedEmails, intent, submit, setUpgradeMember]
  );

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
        data-testid="share-file-invite-button"
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
  onAddToTeam,
}: {
  onDelete?: (submit: FetcherSubmitFunction, userId: string) => Promise<void>;
  onUpdate?: (submit: FetcherSubmitFunction, userId: string, role: UserTeamRole | UserFileRole) => void;
  publicLinkAccess?: PublicLinkAccess;
  isLoggedInUser: boolean;
  user: ShareUser;
  roles: (UserTeamRole | UserFileRole)[];
  onAddToTeam?: () => void;
}) {
  const userId = String(user.id);
  // Use consistent fetcher keys so updates can be tracked across the app
  const fetcherDelete = useFetcher({ key: `delete-user-${userId}` });
  const fetcherUpdate = useFetcher({ key: `update-user-${userId}` });

  const isReadOnly = !((roles.length > 2 && Boolean(onUpdate)) || Boolean(onDelete));
  let activeRole = user.role;
  let error = undefined;

  // If the user's role is being updated, show the optimistic value
  if (fetcherUpdate.state !== 'idle' && isJsonObject(fetcherUpdate.json)) {
    activeRole = fetcherUpdate.json.role as (typeof roles)[0];
  } else if (fetcherUpdate.data && !fetcherUpdate.data.ok) {
    error = 'Failed to update. Try again.';
  }

  const label = useMemo(() => getRoleLabel(activeRole), [activeRole]);

  // If user is being deleted, hide them
  if (fetcherDelete.state !== 'idle') {
    return null;
    // If there was a failure to delete, show an error
  } else if (fetcherDelete.data && !fetcherDelete.data.ok) {
    error = 'Failed to delete. Try again.';
  }

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
              <Tooltip>
                <TooltipTrigger>
                  <ExclamationTriangleIcon className="text-warning" />
                </TooltipTrigger>
                <TooltipContent className="max-w-40 text-center">
                  This person can still edit because the file is set so <em>anyone with the link can edit</em>.
                </TooltipContent>
              </Tooltip>
            )}
            <Select
              value={activeRole}
              onValueChange={(value: 'DELETE' | 'UPGRADE' | (typeof roles)[0]) => {
                if (value === 'DELETE' && onDelete) {
                  onDelete(fetcherDelete.submit, userId);
                } else if (value === 'UPGRADE' && onAddToTeam) {
                  trackEvent('[FileSharing].inviteToTeam.addFromRoleMenu');
                  onAddToTeam();
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
                {onAddToTeam && (
                  <>
                    <SelectSeparator />
                    <SelectItem value="UPGRADE">Add to team</SelectItem>
                  </>
                )}
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
 * Displaying a team OR file invite in the UI. If the invite can be deleted,
 * pass a function to handle the delete.
 */
function ManageInvite({
  invite,
  onDelete,
  onAddToTeam,
}: {
  onAddToTeam?: () => void;
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
              } else if (value === 'UPGRADE' && onAddToTeam) {
                onAddToTeam();
              }
            }}
          >
            <SelectTrigger className={`w-auto`}>
              <SelectValue>{label}</SelectValue>
            </SelectTrigger>

            <SelectContent>
              <SelectItem value={role}>{label}</SelectItem>

              {onAddToTeam && (
                <>
                  <SelectSeparator />
                  <SelectItem value="UPGRADE">Add to team</SelectItem>
                </>
              )}

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
        <Avatar>
          <MailIcon />
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
  const label = name ? name : email;
  const secondary = error ? error : name ? email : '';
  return (
    <ListItem>
      <div className="flex h-6 w-6 items-center justify-center">
        <Avatar src={picture} size="small">
          {label}
        </Avatar>
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

function ListItemTeamFile({
  disabled,
  teamName,
  ownerId,
  uuid,
  loggedInUserId,
}: {
  disabled: boolean;
  teamName: string;
  ownerId: number | null;
  uuid: string;
  loggedInUserId: number;
}) {
  const fetcher = useFetcher();
  const fetcherUrl = ROUTES.API.FILE(uuid);

  let value: 'team-file' | 'personal-file' = ownerId === null ? 'team-file' : 'personal-file';

  // If we're updating, optimistically show the next value
  if (fetcher.state !== 'idle' && isJsonObject(fetcher.json)) {
    const data = fetcher.json as FileAction['request.move'];
    value = data.ownerUserId === null ? 'team-file' : 'personal-file';
  }

  const onCheckedChange = useCallback(
    (checked: boolean) => {
      // checked = true means make it a team file (ownerUserId: null)
      // checked = false means make it a personal file (ownerUserId: loggedInUserId)
      const newOwnerUserId = checked ? null : loggedInUserId;

      if (newOwnerUserId === null) {
        trackEvent('[FileSharing].moveFileToTeam');
      } else {
        trackEvent('[FileSharing].moveFileToPersonal');
      }

      // Submit via fetcher (handles API call)
      const data = getActionFileMove(newOwnerUserId);
      fetcher.submit(data, {
        method: 'POST',
        action: fetcherUrl,
        encType: 'application/json',
      });

      // Also sync to the atom (if in app context) so TopBar updates immediately
      syncFileLocation(uuid, newOwnerUserId);
    },
    [fetcher, fetcherUrl, loggedInUserId, uuid]
  );

  return (
    <ListItem className="py-1">
      <div className="flex h-6 w-6 items-center justify-center">
        {value === 'team-file' ? <GroupIcon /> : <GroupOffIcon />}
      </div>
      <Type variant="body2">Everyone at {teamName}</Type>

      <Select
        disabled={disabled}
        value={value}
        onValueChange={(value: 'team-file' | 'personal-file') => onCheckedChange(value === 'team-file')}
      >
        <SelectTrigger className={`w-auto`}>
          <SelectValue>{value === 'team-file' ? 'Can access' : 'No access'}</SelectValue>
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="team-file">Can access</SelectItem>
          <SelectItem value="personal-file">No access</SelectItem>
        </SelectContent>
      </Select>
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

  const setPublicLinkAccess = useCallback(
    async (newValue: PublicLinkAccess) => {
      const data: FileShareAction['request.update-public-link-access'] = {
        intent: 'update-public-link-access',
        publicLinkAccess: newValue,
      };
      fetcher.submit(data, {
        method: 'POST',
        action: fetcherUrl,
        encType: 'application/json',
      });
    },
    [fetcher, fetcherUrl]
  );

  const optionsByValue: Record<PublicLinkAccess, string> = useMemo(
    () => ({
      NOT_SHARED: 'No access',
      READONLY: 'Can view',
      EDIT: 'Can edit',
    }),
    []
  );

  const activeOptionLabel = useMemo(() => optionsByValue[publicLinkAccess], [publicLinkAccess, optionsByValue]);

  return (
    <ListItem>
      <div className="flex h-6 w-6 items-center justify-center">
        {publicLinkAccess === 'NOT_SHARED' ? <PublicOffIcon /> : <PublicIcon />}
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
        <Select
          disabled={disabled}
          value={publicLinkAccess}
          onValueChange={(value: PublicLinkAccess) => {
            setPublicLinkAccess(value);
          }}
        >
          <SelectTrigger className={`w-auto`} data-testid="public-link-access-select">
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
      </div>
    </ListItem>
  );
}

function ListItem({ className, children }: { className?: string; children: React.ReactNode }) {
  if (Children.count(children) !== 3) {
    console.warn('<ListItem> expects exactly 3 children');
  }

  return (
    <div
      data-testid="share-dialog-list-item"
      className={cn(className, 'flex flex-row items-center gap-3 [&>:nth-child(3)]:ml-auto')}
    >
      {children}
    </div>
  );
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
