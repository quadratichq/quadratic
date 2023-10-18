import { ErrorOutline, KeyboardArrowDown, PeopleAltOutlined } from '@mui/icons-material';
import { Box, Button, Divider, IconButton, InputBase, Menu, MenuItem, Stack, useTheme } from '@mui/material';
import { useState } from 'react';
import { Link, LoaderFunctionArgs, useLoaderData, useParams, useSearchParams } from 'react-router-dom';
import { ApiTypes } from '../api/types';
import { AvatarWithLetters } from '../components/AvatarWithLetters';
import { Empty } from '../components/Empty';
import { QDialogConfirmDelete } from '../components/QDialog';
import { hasAccess } from '../permissions';
import { DashboardHeader } from './components/DashboardHeader';
import { TeamShareMenu } from './components/TeamShareMenu';
import { data, data2 } from './team-1-mock-data';

export const loader = async ({ request, params }: LoaderFunctionArgs) => {
  const { uuid } = params;
  return uuid === '2' ? data2 : data;
};

export const Component = () => {
  const theme = useTheme();
  const [searchParams, setSearchParams] = useSearchParams();
  const [showDeleteDialog, setShowDeleteDialog] = useState<boolean>(false);
  const { team } = useLoaderData() as ApiTypes['/v0/teams/:uuid.GET.response'];
  const [teamName, setTeamName] = useState<string>(team.name);

  const dialog = searchParams.get('dialog');
  const showShareDialog = dialog === 'share';

  return (
    <>
      <DashboardHeader
        title={team.name}
        titleStart={
          <AvatarWithLetters size="large" src={team.picture} sx={{ mr: theme.spacing(1.5) }}>
            {team.name}
          </AvatarWithLetters>
        }
        titleEnd={
          <Box sx={{ position: 'relative', top: '1px', ml: theme.spacing(0.25) }}>
            <EditDropdownMenu setShowDeleteDialog={setShowDeleteDialog} />
          </Box>
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

      <Stack direction="row" alignItems={'center'}>
        <InputBase
          sx={{
            typography: 'h6',
            border: `1px solid ${theme.palette.primary.main}`,
            borderRadius: theme.shape.borderRadius,
            px: theme.spacing(0.5),
          }}
          value={teamName}
          inputProps={{ fontSize: '18px', size: teamName.length > 1 ? teamName.length : 1, outline: '2px solid blue' }}
          onChange={(e) => setTeamName(e.target.value)}
        />
        <KeyboardArrowDown fontSize="small" />
      </Stack>

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

function EditDropdownMenu({ setShowDeleteDialog }: any) {
  const { uuid } = useParams() as { uuid: string };
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
            console.log(uuid);
          }}
        >
          Rename
        </MenuItem>
        <MenuItem onClick={() => {}}>Change avatar</MenuItem>
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
