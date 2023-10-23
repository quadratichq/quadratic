import { ErrorOutline, KeyboardArrowDown, PeopleAltOutlined, QuestionMarkOutlined } from '@mui/icons-material';
import { Box, Button, Divider, IconButton, InputBase, Menu, MenuItem, useTheme } from '@mui/material';
import { SxProps } from '@mui/system';
import { useEffect, useRef, useState } from 'react';
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
import { ApiSchemas, ApiTypes } from '../api/types';
import { AvatarWithLetters } from '../components/AvatarWithLetters';
import { Empty } from '../components/Empty';
import { QDialogConfirmDelete } from '../components/QDialog';
import { shareSearchParamKey } from '../components/ShareMenu';
import { hasAccess } from '../permissions';
import { DashboardHeader } from './components/DashboardHeader';
import { TeamLogoInput } from './components/TeamLogo';
import { TeamShareMenu } from './components/TeamShareMenu';

export const loader = async ({ request, params }: LoaderFunctionArgs) => {
  const { teamUuid } = params as { teamUuid: string };

  // Ensure we have an UUID that matches the schema
  if (!ApiSchemas['/v0/teams/:uuid.GET.response'].shape.team.shape.uuid.safeParse(teamUuid).success) {
    throw new Response('Bad request. Expected a UUID string.');
  }

  const data = await apiClient.getTeam(teamUuid).catch((e) => {
    throw new Response('Failed to fetch team' + e.message);
  });

  return data;
  // return uuid === '2' ? data2 : data;
};

export const action = async ({ request, params }: ActionFunctionArgs) => {
  const { name, picture }: ApiTypes['/v0/teams/:uuid.POST.request'] = await request.json();
  const { teamUuid } = params as { teamUuid: string };

  // await new Promise((resolve) => setTimeout(resolve, 20000));

  try {
    await apiClient.updateTeam(teamUuid, { name, picture });
    return { ok: true };
  } catch (e) {
    return { ok: false };
  }
};

export const Component = () => {
  const theme = useTheme();
  const [searchParams, setSearchParams] = useSearchParams();
  const [showDeleteDialog, setShowDeleteDialog] = useState<boolean>(false);
  const { team } = useLoaderData() as ApiTypes['/v0/teams/:uuid.GET.response'];
  const [isRenaming, setIsRenaming] = useState<boolean>(false);
  const fetcher = useFetcher();

  let name = team.name;
  if (fetcher.state !== 'idle') {
    const optimisticData = fetcher.json as ApiTypes['/v0/teams/:uuid.POST.request'];
    if (optimisticData.name) name = optimisticData.name;
    // picture
  }

  const showShareDialog = searchParams.get(shareSearchParamKey) !== null;

  return (
    <>
      <DashboardHeader
        title={isRenaming ? '' : name}
        titleStart={
          <AvatarWithLetters size="large" src={team.picture} sx={{ mr: theme.spacing(1.5) }}>
            {name}
          </AvatarWithLetters>
        }
        titleEnd={
          <>
            {isRenaming && (
              <RenameInput
                value={name}
                onClose={(newName?: string) => {
                  if (newName) {
                    fetcher.submit({ name: newName }, { method: 'POST', encType: 'application/json' });
                    // setTeamName(newValue);
                    // Post update to server
                  }
                  setIsRenaming(false);
                }}
                sx={{ typography: 'h6' }}
              />
            )}
            <Box sx={{ position: 'relative', top: '1px', ml: theme.spacing(0.25) }}>
              <EditDropdownMenu
                setShowDeleteDialog={setShowDeleteDialog}
                onRename={() => {
                  setIsRenaming(true);
                }}
              />
            </Box>
          </>
        }
        actions={
          <>
            <Button
              startIcon={<PeopleAltOutlined />}
              variant="outlined"
              onClick={() =>
                setSearchParams((prev) => {
                  prev.set(shareSearchParamKey, '');
                  return prev;
                })
              }
            >
              {team.users?.length /* TODO not optional */}
            </Button>
            <Button variant="contained" disableElevation>
              TODO Create file
            </Button>
          </>
        }
      />

      <Box sx={{ p: theme.spacing(2), textAlign: 'center' }}>Team files</Box>

      {showShareDialog && (
        <TeamShareMenu
          onClose={() =>
            setSearchParams((prev) => {
              console.log(prev);
              prev.delete(shareSearchParamKey);
              return prev;
            })
          }
          team={team}
        />
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

/**
 * Takes a value and displays an input that autogrows horizontally with it's
 * contents as the user types. When complete, passes the new value (if there is one).
 * @param props
 * @param props.value - The initial value of the input
 * @param props.onClose - Called when the rename is complete. Passes the new value
 *   or undefined if the rename was cancelled or invalid.
 * @param props.sx - mui sx props
 * @returns
 */
function RenameInput({
  value,
  onClose,
  sx = {},
}: {
  value: string;
  onClose: (newValue?: string) => void;
  sx?: SxProps;
}) {
  const theme = useTheme();
  const inputRef = useRef<HTMLInputElement>();
  const [localValue, setLocalValue] = useState<string>(value);

  // Focus and highlight input contents on mount
  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.setSelectionRange(0, inputRef.current.value.length);
      inputRef.current.focus();
    }
  }, []);

  const componentSx = [
    {
      // Resizing magic
      // Borrowed from https://css-tricks.com/auto-growing-inputs-textareas/
      display: 'inline-grid',
      verticalAlign: 'top',
      alignItems: 'center',
      position: 'relative',
      '&::after, input': {
        width: 'auto',
        minWidth: '1em',
        gridArea: '1 / 2',
      },
      '&::after': {
        content: 'attr(data-value) " "',
        visibility: 'hidden',
        whiteSpace: 'pre-wrap',
        // We don't want this messing with the height of the rendered input
        height: '0px',
      },

      // Component styles
      px: theme.spacing(0.5),
      borderRadius: theme.shape.borderRadius,
      '&.Mui-focused': {
        outline: `2px solid ${theme.palette.primary.main}`,
      },
    },
    // Any overrides
    ...(Array.isArray(sx) ? sx : [sx]),
  ];

  return (
    <InputBase
      data-value={localValue}
      value={localValue}
      inputProps={{ size: 2 }}
      inputRef={inputRef}
      sx={componentSx}
      onChange={(e) => setLocalValue(e.target.value)}
      onKeyUp={(e) => {
        if (e.key === 'Enter') {
          inputRef.current?.blur();
        } else if (e.key === 'Escape') {
          onClose();
        }
      }}
      onBlur={(e: React.FocusEvent<HTMLInputElement>) => {
        const newValue = localValue.trim();

        // Don't allow empty file names
        if (newValue.length === 0) {
          onClose();
          return;
        }

        // Don't pass anything if the name didn't change
        if (newValue === value) {
          onClose();
          return;
        }

        onClose(newValue);
      }}
    />
  );
}

function EditDropdownMenu({ setShowDeleteDialog, onRename }: any) {
  const { access } = useLoaderData() as ApiTypes['/v0/teams/:uuid.GET.response'];
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const open = Boolean(anchorEl);
  const handleClick = (event: React.MouseEvent<HTMLElement>) => {
    setAnchorEl(event.currentTarget);
  };
  const handleClose = () => {
    setAnchorEl(null);
  };

  if (!hasAccess(access, 'TEAM_EDIT')) {
    return null;
  }

  return (
    <>
      <IconButton
        aria-label="more"
        id="long-button"
        size="small"
        aria-controls={open ? 'long-menu' : undefined}
        aria-expanded={open ? 'true' : undefined}
        aria-haspopup="true"
        onClick={handleClick}
      >
        <KeyboardArrowDown fontSize="small" />
      </IconButton>

      <Menu
        id="long-menu"
        MenuListProps={{
          'aria-labelledby': 'long-button',
          dense: true,
        }}
        anchorEl={anchorEl}
        open={open}
        onClose={handleClose}
      >
        <MenuItem
          onClick={() => {
            handleClose();
            onRename();
          }}
        >
          Rename
        </MenuItem>
        <MenuItem component="label">
          Upload logo
          <TeamLogoInput
            onChange={(url: string) => {
              handleClose();
            }}
          />
        </MenuItem>
        {hasAccess(access, 'TEAM_BILLING_EDIT') && (
          <MenuItem key={2} onClick={handleClose}>
            Edit billing
          </MenuItem>
        )}
        {hasAccess(access, 'TEAM_DELETE') && [
          <Divider key={1} />,
          <MenuItem
            key={2}
            onClick={() => {
              setShowDeleteDialog(true);
              handleClose();
            }}
          >
            Delete
          </MenuItem>,
        ]}
      </Menu>
    </>
  );
}

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
        Icon={QuestionMarkOutlined}
        actions={
          <Button variant="contained" disableElevation component={Link} to="/">
            Go home
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
      Icon={ErrorOutline}
      actions={
        <Button variant="contained" disableElevation component={Link} to="/">
          Go home
        </Button>
      }
      severity="error"
    />
  );
};
