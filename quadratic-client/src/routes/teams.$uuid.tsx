import { ShareTeamDialog } from '@/components/ShareDialog';
import { DialogRenameItem } from '@/dashboard/components/DialogRenameItem';
import { Button } from '@/shadcn/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/shadcn/ui/dropdown-menu';
import { useTheme } from '@mui/material';
import { CaretDownIcon, ExclamationTriangleIcon, PersonIcon } from '@radix-ui/react-icons';
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
  useSearchParams,
} from 'react-router-dom';
import { apiClient } from '../api/apiClient';
import { AvatarWithLetters } from '../components/AvatarWithLetters';
import { Empty } from '../components/Empty';
import { QDialogConfirmDelete } from '../components/QDialog';
import { DashboardHeader } from '../dashboard/components/DashboardHeader';
import { TeamLogoInput } from '../dashboard/components/TeamLogo';
import { useUpdateQueryStringValueWithoutNavigation } from '../hooks/useUpdateQueryStringValueWithoutNavigation';

export const loader = async ({ request, params }: LoaderFunctionArgs) => {
  const { uuid } = params as { uuid: string };
  return await apiClient.teams.get(uuid);
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
  'request.update-team-user': ApiTypes['/v0/teams/:uuid/users/:userId.POST.request'] & {
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

  await new Promise((resolve, reject) => setTimeout(resolve, 1000));

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
    users,
    userMakingRequest: { teamPermissions },
  } = loaderData;
  const [isRenaming, setIsRenaming] = useState<boolean>(false);
  const fetcher = useFetcher();
  const [shareSearchParamValue, setShareSearchParamValue] = useState<string | null>(searchParams.get('share'));
  useUpdateQueryStringValueWithoutNavigation('share', shareSearchParamValue);

  // const [shareQueryValue, setShareQueryValue] = useState<string>('');
  // useUpdateQueryStringValueWithoutNavigation("share", queryValue);

  let name = team.name;
  if (fetcher.state !== 'idle') {
    name = (fetcher.json as TeamAction['request.update-team']).name as string; // TODO fix zod types
    // TODO: picture
  }

  const handleClose = () => setIsRenaming(false);

  const showShareDialog = shareSearchParamValue !== null;

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
        }
        actions={
          <div className={`flex items-center gap-2`}>
            <Button
              variant="outline"
              onClick={() => {
                setShareSearchParamValue('');
              }}
            >
              <PersonIcon className={`mr-1`} /> {users.length}
            </Button>
            <Button variant="outline">Import file</Button>
            <Button>Create file</Button>
          </div>
        }
      />

      <div className="opacity-1 border border-dashed border-border py-20 text-center">Team files</div>

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

// TODO: fix when we merge better errors PR
export const ErrorBoundary = () => {
  const error = useRouteError();

  if (isRouteErrorResponse(error)) {
    console.error(error);
    // If the future, we can differentiate between the different kinds of file
    // loading errors and be as granular in the message as we like.
    // e.g. file found but didn't validate. file couldn't be found on server, etc.
    // But for now, we'll just show a 404
    return (
      <Empty
        title="404: team not found"
        description="This team may have been deleted, moved, or made unavailable. Try reaching out to the team owner."
        Icon={ExclamationTriangleIcon}
        actions={
          <Button asChild>
            <Link to="/">Go home</Link>
          </Button>
        }
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
