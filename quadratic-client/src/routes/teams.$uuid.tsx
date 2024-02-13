import { ShareTeamDialog } from '@/components/ShareDialog';
import { ROUTES, ROUTE_LOADER_IDS } from '@/constants/routes';
import { CONTACT_URL } from '@/constants/urls';
import CreateFileButton from '@/dashboard/components/CreateFileButton';
import { DialogRenameItem } from '@/dashboard/components/DialogRenameItem';
import { FilesList } from '@/dashboard/components/FilesList';
import { Button } from '@/shadcn/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/shadcn/ui/dropdown-menu';
import { Avatar, AvatarGroup, useTheme } from '@mui/material';
import { CaretDownIcon, ExclamationTriangleIcon, FileIcon } from '@radix-ui/react-icons';
import { ApiTypes } from 'quadratic-shared/typesAndSchemas';
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
import { AvatarWithLetters } from '../components/AvatarWithLetters';
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
  'request.update-team': ApiTypes['/v0/teams/:uuid.POST.request'] & {
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
  const theme = useTheme();
  const [searchParams] = useSearchParams();
  const [showDeleteDialog, setShowDeleteDialog] = useState<boolean>(false);
  const loaderData = useLoaderData() as ApiTypes['/v0/teams/:uuid.GET.response'];
  const {
    team,
    files,
    users,
    userMakingRequest: { teamPermissions },
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
  const showShareDialog = shareSearchParamValue !== null;
  const avatarSxProps = { width: 32, height: 32, fontSize: '1rem' };

  return (
    <>
      <DashboardHeader
        title={name}
        titleStart={
          <AvatarWithLetters size="large" src={team.picture} sx={{ mr: theme.spacing(1.5) }}>
            {name}
          </AvatarWithLetters>
        }
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
                    Upload logo
                    <TeamLogoInput
                      onChange={(url: string) => {
                        handleClose();
                      }}
                    />
                  </label>
                </DropdownMenuItem>
                {teamPermissions.includes('TEAM_BILLING_EDIT') && (
                  <DropdownMenuItem onClick={() => {}}>Edit billing</DropdownMenuItem>
                )}
                {teamPermissions.includes('TEAM_DELETE') && [
                  <DropdownMenuSeparator key={1} />,
                  <DropdownMenuItem
                    key={2}
                    onClick={() => {
                      setShowDeleteDialog(true);
                    }}
                  >
                    Delete
                  </DropdownMenuItem>,
                ]}
              </DropdownMenuContent>
            </DropdownMenu>
          ) : null
        }
        actions={
          <div className={`flex items-center gap-2`}>
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
