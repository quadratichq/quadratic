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
import { shareSearchParamKey, shareSearchParamValuesById } from '../components/ShareMenu';
import { DashboardHeader } from '../dashboard/components/DashboardHeader';
import { TeamLogoInput } from '../dashboard/components/TeamLogo';
import { TeamShareMenu } from '../dashboard/components/TeamShareMenu';
import { useUpdateQueryStringValueWithoutNavigation } from '../hooks/useUpdateQueryStringValueWithoutNavigation';
import { hasAccess } from '../permissions';

export const loader = async ({ request, params }: LoaderFunctionArgs) => {
  const { teamUuid } = params as { teamUuid: string };
  return await apiClient.getTeam(teamUuid);
};

export type TeamAction = {
  'request.invite-user': {
    action: 'invite-user';
    payload: ApiTypes['/v0/teams/:uuid/sharing.POST.request'];
  };
  'request.update-team': {
    action: 'update-team';
    payload: ApiTypes['/v0/teams/:uuid.POST.request'];
  };
  'request.update-user': {
    action: 'update-user';
    id: number;
    payload: ApiTypes['/v0/teams/:uuid/sharing/:userId.POST.request'];
  };
  'request.delete-user': {
    action: 'delete-user';
    id: number;
  };
  request:
    | TeamAction['request.update-team']
    | TeamAction['request.invite-user']
    | TeamAction['request.update-user']
    | TeamAction['request.delete-user'];
  response: {
    ok: boolean;
    action: TeamAction['request'][keyof TeamAction['request']];
  } | null;
};

export const action = async ({ request, params }: ActionFunctionArgs): Promise<TeamAction['response']> => {
  const data = (await request.json()) as TeamAction['request'];
  const { teamUuid } = params as { teamUuid: string };
  const { action } = data;

  if (action === 'update-team') {
    try {
      const {
        payload: { name, picture },
      } = data;
      await new Promise((resolve) => setTimeout(resolve, 10000));
      await apiClient.updateTeam(teamUuid, { name, picture });
      return { ok: true, action };
    } catch (e) {
      return { ok: false, action };
    }
  }

  if (action === 'invite-user') {
    try {
      await new Promise((resolve) => setTimeout(resolve, 1000));
      const {
        payload: { email, role },
      } = data;
      await apiClient.updateUserInTeam(teamUuid, { email, role });
      return { ok: true, action };
    } catch (e) {
      return { ok: false, action };
    }
  }

  if (action === 'update-user') {
    try {
      await new Promise((resolve, reject) => setTimeout(reject, 3000));
      // const { payload: { id, role } } = data;
      // apiClient.updateUserInTeam(id, { role })
      return { ok: true, action };
    } catch (e) {
      return { ok: false, action };
    }
  }

  if (action === 'delete-user') {
    try {
      const { id } = data;
      await apiClient.deleteUserInTeam(teamUuid, id);
      // console.warn('Deleting user', data);
      // await new Promise((resolve, reject) => setTimeout(reject, 3000));
      return { ok: true, action };
    } catch (e) {
      return { ok: false, action };
    }
  }

  return null;
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
  const [shareSearchParamValue, setShareSearchParamValue] = useState<string | null>(
    searchParams.get(shareSearchParamKey)
  );
  useUpdateQueryStringValueWithoutNavigation(shareSearchParamKey, shareSearchParamValue);

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
              {hasAccess(access, 'TEAM_BILLING_EDIT') && (
                <DropdownMenuItem onClick={() => {}}>Edit billing</DropdownMenuItem>
              )}
              {hasAccess(access, 'TEAM_DELETE') && [
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
                setShareSearchParamValue(shareSearchParamValuesById.OPEN);
              }}
            >
              <PersonIcon className={`mr-1`} /> {team.users.length}
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
            const data: TeamAction['request.update-team'] = { action: 'update-team', payload: { name } };
            fetcher.submit(data, { method: 'POST', encType: 'application/json' });
          }}
        />
      )}
      {showShareDialog && <TeamShareMenu onClose={() => setShareSearchParamValue(null)} data={loaderData} />}
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
