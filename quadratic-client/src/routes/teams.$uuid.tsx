import { AvatarTeam } from '@/components/AvatarTeam';
import { ShareTeamDialog } from '@/components/ShareDialog';
import { ROUTES, ROUTE_LOADER_IDS } from '@/constants/routes';
import { CONTACT_URL } from '@/constants/urls';
import CreateFileButton from '@/dashboard/components/CreateFileButton';
import { DialogRenameItem } from '@/dashboard/components/DialogRenameItem';
import { FilesList } from '@/dashboard/components/FilesList';
import { Button } from '@/shadcn/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/shadcn/ui/dropdown-menu';
import { Avatar, AvatarGroup } from '@mui/material';
import { CaretDownIcon, ExclamationTriangleIcon, FileIcon } from '@radix-ui/react-icons';
import { ApiTypes, TeamSubscriptionStatus } from 'quadratic-shared/typesAndSchemas';
import { useState } from 'react';
import {
  ActionFunctionArgs,
  Link,
  LoaderFunctionArgs,
  isRouteErrorResponse,
  useFetcher,
  useLoaderData,
  useRouteError,
  useRouteLoaderData,
  useSearchParams,
} from 'react-router-dom';
import { apiClient } from '../api/apiClient';
import { Empty } from '../components/Empty';
import { QDialogConfirmDelete } from '../components/QDialog';
import { DashboardHeader } from '../dashboard/components/DashboardHeader';
import { TeamLogoInput } from '../dashboard/components/TeamLogo';

export const useTeamRouteLoaderData = () => useRouteLoaderData(ROUTE_LOADER_IDS.TEAM) as LoaderData | undefined;

type LoaderData = ApiTypes['/v0/teams/:uuid.GET.response'];
export const loader = async ({ request, params }: LoaderFunctionArgs): Promise<LoaderData> => {
  const { uuid } = params as { uuid: string };
  const data = await apiClient.teams.get(uuid);

  // Sort the users so the logged-in user is first in the list
  data.users.sort((a, b) => {
    const loggedInUser = data.userMakingRequest.id;
    // Move the logged in user to the front
    if (a.id === loggedInUser && b.id !== loggedInUser) return -1;
    // Keep the logged in user at the front
    if (a.id !== loggedInUser && b.id === loggedInUser) return 1;
    // Leave the order as is for others
    return 0;
  });

  return data;
};

export type TeamAction = {
  'request.update-team': ApiTypes['/v0/teams/:uuid.PATCH.request'] & {
    intent: 'update-team';
  };
  'request.create-team-invite': ApiTypes['/v0/teams/:uuid/invites.POST.request'] & {
    intent: 'create-team-invite';
  };
  'request.delete-team-invite': {
    intent: 'delete-team-invite';
    inviteId: string;
  };
  'request.update-team-user': ApiTypes['/v0/teams/:uuid/users/:userId.PATCH.request'] & {
    intent: 'update-team-user';
    userId: string;
  };
  'request.delete-team-user': {
    intent: 'delete-team-user';
    userId: string;
  };
  request:
    | TeamAction['request.update-team']
    | TeamAction['request.create-team-invite']
    | TeamAction['request.delete-team-invite']
    | TeamAction['request.update-team-user']
    | TeamAction['request.delete-team-user'];
  response: {
    ok: boolean;
  };
};

export const action = async ({ request, params }: ActionFunctionArgs): Promise<TeamAction['response']> => {
  const data = (await request.json()) as TeamAction['request'];
  const { uuid } = params as { uuid: string };
  const { intent } = data;

  if (intent === 'update-team') {
    try {
      // TODO: uploading picture vs. name
      const { name, picture } = data;
      await apiClient.teams.update(uuid, { name, picture });
      return { ok: true };
    } catch (e) {
      return { ok: false };
    }
  }

  if (intent === 'create-team-invite') {
    try {
      const { email, role } = data;
      await apiClient.teams.invites.create(uuid, { email, role });
      return { ok: true };
    } catch (e) {
      return { ok: false };
    }
  }

  if (intent === 'delete-team-invite') {
    try {
      const { inviteId } = data;
      await apiClient.teams.invites.delete(uuid, inviteId);
      return { ok: true };
    } catch (e) {
      return { ok: false };
    }
  }

  if (intent === 'update-team-user') {
    try {
      const { userId, role } = data;
      await apiClient.teams.users.update(uuid, userId, { role });
      return { ok: true };
    } catch (e) {
      return { ok: false };
    }
  }

  if (intent === 'delete-team-user') {
    try {
      const { userId } = data;
      await apiClient.teams.users.delete(uuid, userId);
      return { ok: true };
    } catch (e) {
      return { ok: false };
    }
  }

  console.error('Unknown action');
  return { ok: false };
};

export const Component = () => {
  const [searchParams] = useSearchParams();
  const [showDeleteDialog, setShowDeleteDialog] = useState<boolean>(false);
  const loaderData = useLoaderData() as ApiTypes['/v0/teams/:uuid.GET.response'];
  const {
    team,
    files,
    users,
    userMakingRequest: { teamPermissions },
    billing,
  } = loaderData;
  const [isRenaming, setIsRenaming] = useState<boolean>(false);
  const fetcher = useFetcher();
  const [shareSearchParamValue, setShareSearchParamValue] = useState<string | null>(searchParams.get('share'));

  let name = team.name;
  if (fetcher.state !== 'idle') {
    name = (fetcher.json as TeamAction['request.update-team']).name as string; // TODO fix zod types
    // TODO: picture
  }

  const handleClose = () => setIsRenaming(false);
  const canEdit = teamPermissions.includes('TEAM_EDIT');
  const canEditBilling = teamPermissions.includes('TEAM_BILLING_EDIT');
  const showShareDialog = shareSearchParamValue !== null;
  const avatarSxProps = { width: 24, height: 24, fontSize: '.875rem' };

  return (
    <>
      <TeamBillingIssue billingStatus={billing.status} teamUuid={team.uuid} canEditBilling={canEditBilling} />
      <DashboardHeader
        title={name}
        titleStart={<AvatarTeam src={team.picture} className="mr-3 h-9 w-9" />}
        titleEnd={
          canEdit ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon-sm" className="ml-1 rounded-full">
                  <CaretDownIcon />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent>
                <DropdownMenuItem onClick={() => setIsRenaming(true)}>Rename</DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <label>
                    Change logo
                    <TeamLogoInput
                      onChange={(url: string) => {
                        handleClose();
                      }}
                    />
                  </label>
                </DropdownMenuItem>
                {teamPermissions.includes('TEAM_BILLING_EDIT') && (
                  <DropdownMenuItem
                    onClick={() => {
                      // Get the billing session URL
                      apiClient.teams.billing.getPortalSessionUrl(team.uuid).then((data) => {
                        window.location.href = data.url;
                      });
                    }}
                  >
                    Update billing
                  </DropdownMenuItem>
                )}
                {/* {teamPermissions.includes('TEAM_DELETE') && [
                  <DropdownMenuSeparator key={1} />,
                  <DropdownMenuItem
                    key={2}
                    onClick={() => {
                      setShowDeleteDialog(true);
                    }}
                  >
                    Delete
                  </DropdownMenuItem>,
                ]} */}
              </DropdownMenuContent>
            </DropdownMenu>
          ) : null
        }
        actions={
          <div className={`flex items-center gap-2`}>
            <div className="hidden lg:block">
              <Button
                asChild
                variant={null}
                onClick={() => {
                  setShareSearchParamValue('');
                }}
              >
                <AvatarGroup
                  max={4}
                  sx={{ cursor: 'pointer', pr: 0 }}
                  slotProps={{ additionalAvatar: { sx: avatarSxProps } }}
                >
                  {users.map((user, key) => (
                    <Avatar key={key} alt={user.name} src={user.picture} sx={avatarSxProps} />
                  ))}
                </AvatarGroup>
              </Button>
            </div>
            <Button
              variant="outline"
              onClick={() => {
                setShareSearchParamValue('');
              }}
            >
              Members
            </Button>
            {canEdit && <CreateFileButton />}
          </div>
        }
      />

      <FilesList
        files={files.map((data) => ({ ...data.file, permissions: data.userMakingRequest.filePermissions }))}
        emptyState={
          <Empty
            title="No team files"
            description={`Files created by${canEdit ? ' you or ' : ' '}team members will show up here.`}
            actions={
              canEdit ? (
                <Button asChild variant="secondary">
                  <Link to={ROUTES.CREATE_FILE_IN_TEAM(team.uuid)}>Create file</Link>
                </Button>
              ) : null
            }
            Icon={FileIcon}
          />
        }
      />

      {isRenaming && (
        <DialogRenameItem
          itemLabel="Team"
          onClose={() => {
            setIsRenaming(false);
          }}
          value={name}
          onSave={(name: string) => {
            setIsRenaming(false);
            const data: TeamAction['request.update-team'] = { intent: 'update-team', name };
            fetcher.submit(data, { method: 'POST', encType: 'application/json' });
          }}
        />
      )}
      {showShareDialog && <ShareTeamDialog onClose={() => setShareSearchParamValue(null)} data={loaderData} />}
      {showDeleteDialog && (
        <QDialogConfirmDelete
          entityName={name}
          entityNoun="team"
          onClose={() => {
            setShowDeleteDialog(false);
          }}
          onDelete={() => {
            /* TODO */
          }}
        >
          Deleting this team will delete all associated data (such as files) for all users and billing will cease.
        </QDialogConfirmDelete>
      )}
    </>
  );
};

export const ErrorBoundary = () => {
  const error = useRouteError();

  const actions = (
    <div className={`flex justify-center gap-2`}>
      <Button asChild variant="outline">
        <a href={CONTACT_URL} target="_blank" rel="noreferrer">
          Get help
        </a>
      </Button>
      <Button asChild variant="default">
        <Link to="/">Go home</Link>
      </Button>
    </div>
  );

  if (isRouteErrorResponse(error)) {
    if (error.status === 400)
      return (
        <Empty
          title="Bad request"
          description="Ensure you have the right URL for this team and try again."
          Icon={ExclamationTriangleIcon}
          actions={actions}
        />
      );
    if (error.status === 404)
      return (
        <Empty
          title="Team not found"
          description="This team may have been deleted, moved, or made unavailable. Try reaching out to the team owner."
          Icon={ExclamationTriangleIcon}
          actions={actions}
        />
      );
  }

  // Maybe we log this to Sentry someday...
  console.error(error);
  return (
    <Empty
      title="Unexpected error"
      description="Something went wrong loading this team. If the error continues, contact us."
      Icon={ExclamationTriangleIcon}
      actions={
        <Button asChild>
          <Link to="/">Go home</Link>
        </Button>
      }
      severity="error"
    />
  );
};

const TeamBillingIssue = (props: {
  teamUuid: string;
  billingStatus: TeamSubscriptionStatus | undefined;
  canEditBilling: boolean;
}) => {
  const { billingStatus, teamUuid, canEditBilling } = props;

  // There is no issue if the billing status is active or trialing.
  if (billingStatus === 'ACTIVE' || billingStatus === 'TRIALING') {
    return null;
  }

  // Otherwise, show the billing issue overlay.
  let heading = 'Team Billing Issue';
  let description = '';
  let buttonLabel = 'Fix payment';
  if (billingStatus === 'CANCELED') {
    description = 'Your Team’s subscription has been canceled. Please resubscribe.';
    buttonLabel = 'Resubscribe';
  } else if (billingStatus === 'INCOMPLETE' || billingStatus === 'INCOMPLETE_EXPIRED') {
    description = 'Your Team’s subscription is incomplete. Please update your payment method to reactivate.';
  } else if (billingStatus === 'PAST_DUE') {
    description = 'Your Team’s subscription is past due. Please update your payment method to reactivate.';
  } else if (billingStatus === 'UNPAID') {
    description = 'Your Team’s subscription is unpaid. Please update your payment method to reactivate.';
  } else if (billingStatus === 'PAUSED') {
    description = 'Your Team’s subscription is paused. Please update your payment method to reactivate.';
  } else if (billingStatus === undefined) {
    // If the billing status is undefined, the user never subscribed.
    heading = 'Subscribe to Teams';
    description = 'You must have an active subscription to access Quadratic Teams. Subscribe to continue.';
    buttonLabel = 'Continue';
  }

  if (!canEditBilling) {
    description = 'Your Team’s subscription is inactive. Please contact the Team owner to reactivate.';
  }

  return (
    <div
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
        backgroundColor: 'rgba(0, 0, 0, 0.5)', // Semi-transparent black overlay
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        zIndex: 9999, // Ensure it's above other content
        backdropFilter: 'blur(5px)', // Apply blur effect to background
      }}
    >
      <div className="rounded bg-white p-4">
        <Empty
          title={heading}
          description={description}
          Icon={ExclamationTriangleIcon}
          actions={
            <div className={`flex justify-center gap-2`}>
              <Button asChild variant="outline">
                <a href={CONTACT_URL} target="_blank" rel="noreferrer">
                  Get help
                </a>
              </Button>
              {canEditBilling && (
                <Button
                  variant="default"
                  onClick={() => {
                    if (
                      // If the billing status is undefined, the user never subscribed.
                      billingStatus === undefined ||
                      // If the billing status is incomplete and expired, the user must resubscribe.
                      billingStatus === 'INCOMPLETE_EXPIRED' ||
                      // If the billing status is canceled or unpaid, the user must resubscribe.
                      billingStatus === 'CANCELED' ||
                      billingStatus === 'UNPAID'
                    ) {
                      apiClient.teams.billing.getCheckoutSessionUrl(teamUuid).then((data) => {
                        window.open(data.url);
                      });
                    } else {
                      apiClient.teams.billing.getPortalSessionUrl(teamUuid).then((data) => {
                        window.open(data.url, '_blank');
                      });
                    }
                  }}
                >
                  <span>{buttonLabel}</span>
                </Button>
              )}
            </div>
          }
        />
      </div>
    </div>
  );
};
