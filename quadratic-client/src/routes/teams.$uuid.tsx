import { AvatarTeam } from '@/components/AvatarTeam';
import { ShareTeamDialog } from '@/components/ShareDialog';
import { ROUTES, ROUTE_LOADER_IDS } from '@/constants/routes';
import { CONTACT_URL } from '@/constants/urls';
import CreateFileButton from '@/dashboard/components/CreateFileButton';
import { DialogRenameItem } from '@/dashboard/components/DialogRenameItem';
import { FilesList } from '@/dashboard/components/FilesList';
import { Button } from '@/shadcn/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/shadcn/ui/dropdown-menu';
import { isJsonObject } from '@/utils/isJsonObject';
import { Avatar, AvatarGroup } from '@mui/material';
import { ExclamationTriangleIcon, FileIcon, GearIcon, InfoCircledIcon } from '@radix-ui/react-icons';
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

export const useTeamRouteLoaderData = () => useRouteLoaderData(ROUTE_LOADER_IDS.TEAM) as LoaderData | undefined;

type LoaderData = ApiTypes['/v0/teams/:uuid.GET.response'];
export const loader = async ({ request, params }: LoaderFunctionArgs): Promise<LoaderData> => {
  const { uuid } = params as { uuid: string };
  const data = await apiClient.teams.get(uuid).catch((error) => {
    const { status } = error;
    if (status >= 400 && status < 500) throw new Response('4xx level error', { status });
    throw error;
  });

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
      const { name } = data;
      await apiClient.teams.update(uuid, { name });
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
  if (fetcher.state !== 'idle' && isJsonObject(fetcher.json)) {
    name = (fetcher.json as TeamAction['request.update-team']).name;
  }

  const canEdit = teamPermissions.includes('TEAM_EDIT');
  const canEditBilling = teamPermissions.includes('TEAM_BILLING_EDIT');
  const showShareDialog = shareSearchParamValue !== null;
  const avatarSxProps = { width: 24, height: 24, fontSize: '.875rem' };
  const billingStatus = billing.status;
  const hasBillingIssue = !(billingStatus === 'ACTIVE' || billingStatus === 'TRIALING');

  return (
    <>
      <div
        {...(hasBillingIssue ? { inert: 'inert' } : {})}
        className={`${hasBillingIssue ? 'opacity-30 blur-sm' : ''}`}
      >
        <DashboardHeader
          title={name}
          titleStart={<AvatarTeam className="mr-3 h-9 w-9" />}
          titleEnd={
            canEdit ? (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon-sm" className="ml-1 rounded-full">
                    <GearIcon />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent>
                  <DropdownMenuItem onClick={() => setIsRenaming(true)}>Rename team</DropdownMenuItem>
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
              title="No team files yet"
              description={`Files created by${canEdit ? ' you or ' : ' '}your team members will show up here.`}
              actions={
                canEdit ? (
                  <Button asChild variant="secondary">
                    <Link to={ROUTES.CREATE_FILE_IN_TEAM(team.uuid)}>Create a file</Link>
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
      </div>

      {hasBillingIssue && (
        <TeamBillingIssue billingStatus={billingStatus} teamUuid={team.uuid} canEditBilling={canEditBilling} />
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
    if (error.status === 403)
      return (
        <Empty
          title="You don’t have access to this team"
          description="Reach out to the team owner for permission to access this team."
          Icon={InfoCircledIcon}
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
  billingStatus: Exclude<TeamSubscriptionStatus, 'ACTIVE' | 'TRIALING'> | undefined;
  canEditBilling: boolean;
}) => {
  const { billingStatus, teamUuid, canEditBilling } = props;

  const buttonActionGoToBillingPortal = () => {
    apiClient.teams.billing.getPortalSessionUrl(teamUuid).then((data) => {
      window.location.href = data.url;
    });
  };

  const buttonActionResubscribe = () => {
    apiClient.teams.billing.getCheckoutSessionUrl(teamUuid).then((data) => {
      window.location.href = data.url;
    });
  };

  // Otherwise, show the billing issue overlay.
  let headingDefault = 'Team billing issue';

  const statusOptions = {
    CANCELED: {
      heading: headingDefault,
      description: 'Your team’s subscription has been canceled. Please resubscribe.',
      buttonLabel: 'Resubscribe',
      buttonAction: buttonActionResubscribe,
    },
    INCOMPLETE: {
      heading: headingDefault,
      description: 'Your team’s subscription is incomplete. Please update your payment method to reactivate.',
      buttonLabel: 'Fix payment',
      buttonAction: buttonActionGoToBillingPortal,
    },
    INCOMPLETE_EXPIRED: {
      heading: headingDefault,
      description: 'Your team’s subscription is incomplete. Please update your payment method to reactivate.',
      buttonLabel: 'Fix payment',
      buttonAction: buttonActionResubscribe,
    },
    PAST_DUE: {
      heading: headingDefault,
      description: 'Your team’s subscription is past due. Please update your payment method to reactivate.',
      buttonLabel: 'Fix payment',
      buttonAction: buttonActionGoToBillingPortal,
    },
    UNPAID: {
      heading: headingDefault,
      description: 'Your team’s subscription is unpaid. Please pay to reactivate.',
      buttonLabel: 'Fix payment',
      buttonAction: buttonActionResubscribe,
    },
    PAUSED: {
      heading: headingDefault,
      description: 'Your team’s subscription is paused. Please update your payment method to reactivate.',
      buttonLabel: 'Fix payment',
      buttonAction: buttonActionGoToBillingPortal,
    },
    undefined: {
      heading: 'Subscription requried',
      description: 'You must have an active subscription to access this team.',
      buttonLabel: 'Subscribe',
      buttonAction: buttonActionResubscribe,
    },
  };

  let heading = statusOptions[billingStatus ?? 'undefined'].heading;
  let description = statusOptions[billingStatus ?? 'undefined'].description;
  let buttonLabel = statusOptions[billingStatus ?? 'undefined'].buttonLabel;
  let buttonAction = statusOptions[billingStatus ?? 'undefined'].buttonAction;

  return (
    <div className="absolute left-0 top-0 flex h-full w-full items-center justify-center">
      <div className="rounded border border-border bg-background px-4 shadow-sm">
        <Empty
          title={heading}
          description={
            canEditBilling
              ? description
              : 'Your team’s subscription is inactive. Please contact the team owner to reactivate.'
          }
          Icon={ExclamationTriangleIcon}
          actions={
            <div className={`flex justify-center gap-2`}>
              <Button asChild variant="outline">
                <a href={CONTACT_URL} target="_blank" rel="noreferrer">
                  Get help
                </a>
              </Button>
              {canEditBilling && (
                <Button variant="default" onClick={buttonAction}>
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
