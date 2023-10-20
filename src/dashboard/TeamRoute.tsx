import { ErrorOutline, KeyboardArrowDown, PeopleAltOutlined } from '@mui/icons-material';
import { Box, Button, Divider, IconButton, InputBase, Menu, MenuItem, useTheme } from '@mui/material';
import { SxProps } from '@mui/system';
import { useEffect, useRef, useState } from 'react';
import { Link, LoaderFunctionArgs, useLoaderData, useSearchParams } from 'react-router-dom';
import { apiClient } from '../api/apiClient';
import { ApiTypes } from '../api/types';
import { AvatarWithLetters } from '../components/AvatarWithLetters';
import { Empty } from '../components/Empty';
import { QDialogConfirmDelete } from '../components/QDialog';
import { hasAccess } from '../permissions';
import { DashboardHeader } from './components/DashboardHeader';
import { TeamLogoInput } from './components/TeamLogo';
import { TeamShareMenu } from './components/TeamShareMenu';

export const loader = async ({ request, params }: LoaderFunctionArgs) => {
  // const { uuid } = params as { uuid: string };
  const data = await apiClient.getTeams().catch((e) => {
    console.error(e);
    return undefined;
  });
  return data;
  // return uuid === '2' ? data2 : data;
};

export const Component = () => {
  const theme = useTheme();
  const [searchParams, setSearchParams] = useSearchParams();
  const [showDeleteDialog, setShowDeleteDialog] = useState<boolean>(false);
  const { team } = useLoaderData() as ApiTypes['/v0/teams/:uuid.GET.response'];
  const [teamName, setTeamName] = useState<string>(team.name);
  const [isRenaming, setIsRenaming] = useState<boolean>(false);

  const dialog = searchParams.get('dialog');
  const showShareDialog = dialog === 'share';

  return (
    <>
      <DashboardHeader
        title={isRenaming ? '' : teamName}
        titleStart={
          <AvatarWithLetters size="large" src={team.picture} sx={{ mr: theme.spacing(1.5) }}>
            {team.name}
          </AvatarWithLetters>
        }
        titleEnd={
          <>
            {isRenaming && (
              <RenameInput
                value={teamName}
                onClose={(newValue?: string) => {
                  if (newValue) {
                    setTeamName(newValue);
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
                  prev.set('dialog', 'share');
                  return prev;
                })
              }
            >
              {team.users.length}
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
              prev.delete('dialog');
              return prev;
            })
          }
          team={team}
        />
      )}
      {showDeleteDialog && (
        <QDialogConfirmDelete
          entityName={team.name}
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
  // const error = useRouteError();

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
