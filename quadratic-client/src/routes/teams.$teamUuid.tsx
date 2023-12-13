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
  const { teamUuid } = params as { teamUuid: string };
  return await apiClient.teams.get(teamUuid);
};

export type TeamAction = {
  'request.update-team': {
    intent: 'update-team';
    payload: ApiTypes['/v0/teams/:uuid.POST.request'];
  };
  'request.create-team-invite': {
    intent: 'create-team-invite';
    payload: ApiTypes['/v0/teams/:uuid/invites.POST.request'];
  };
  'request.delete-team-invite': {
    intent: 'delete-team-invite';
    inviteId: string;
  };
  'request.update-team-user': {
    intent: 'update-team-user';
    userId: string;
    payload: ApiTypes['/v0/teams/:uuid/users/:userId.POST.request'];
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
  const { teamUuid } = params as { teamUuid: string };
  const { intent } = data;

  await new Promise((resolve, reject) => setTimeout(resolve, 1000));

  if (intent === 'update-team') {
    try {
      // TODO: uploading picture vs. name
      const {
        payload: { name, picture },
      } = data;
      await apiClient.teams.update(teamUuid, { name, picture });
      return { ok: true };
    } catch (e) {
      return { ok: false };
    }
  }

  if (intent === 'create-team-invite') {
    try {
      const { payload } = data;
      await apiClient.teams.invites.create(teamUuid, payload);
      return { ok: true };
    } catch (e) {
      return { ok: false };
    }
  }

  if (intent === 'delete-team-invite') {
    try {
      const { inviteId } = data;
      await apiClient.teams.invites.delete(teamUuid, inviteId);
      return { ok: true };
    } catch (e) {
      return { ok: false };
    }
  }

  if (intent === 'update-team-user') {
    try {
      const {
        userId,
        payload: { role },
      } = data;
      await apiClient.teams.users.update(teamUuid, userId, { role });
      return { ok: true };
    } catch (e) {
      return { ok: false };
    }
  }

  if (intent === 'delete-team-user') {
    try {
      const { userId } = data;
      await apiClient.teams.users.delete(teamUuid, userId);
      // console.warn('Deleting user', data);
      // await new Promise((resolve, reject) => setTimeout(reject, 3000));
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
    user: { access },
  } = loaderData;
  const [isRenaming, setIsRenaming] = useState<boolean>(false);
  const fetcher = useFetcher();
  const [shareSearchParamValue, setShareSearchParamValue] = useState<string | null>(searchParams.get('share'));
  useUpdateQueryStringValueWithoutNavigation('share', shareSearchParamValue);

  // const [shareQueryValue, setShareQueryValue] = useState<string>('');
  // useUpdateQueryStringValueWithoutNavigation("share", queryValue);

  let name = team.name;
  if (fetcher.state !== 'idle') {
    name = (fetcher.json as TeamAction['request.update-team']).payload.name as string; // TODO fix zod types
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
              {access.includes('TEAM_BILLING_EDIT') && (
                <DropdownMenuItem onClick={() => {}}>Edit billing</DropdownMenuItem>
              )}
              {access.includes('TEAM_DELETE') && [
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
          access.includes('TEAM_EDIT') ? (
            <div className={`flex items-center gap-2`}>
              <Button
                variant="outline"
                onClick={() => {
                  setShareSearchParamValue('');
                }}
              >
                <PersonIcon className={`mr-1`} /> {team.users.length}
              </Button>
              <Button variant="outline">Import file</Button>
              <Button>Create file</Button>
            </div>
          ) : null
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
            const data: TeamAction['request.update-team'] = { intent: 'update-team', payload: { name } };
            fetcher.submit(data, { method: 'POST', encType: 'application/json' });
          }}
        />
      )}
      {(true || showShareDialog) && (
        <ShareTeamDialog onClose={() => setShareSearchParamValue(null)} data={loaderData} />
      )}
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
