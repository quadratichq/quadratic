import { ErrorOutline, KeyboardArrowDown, PeopleAltOutlined } from '@mui/icons-material';
import { Box, Button, Divider, IconButton, Menu, MenuItem, useTheme } from '@mui/material';
import { Link, LoaderFunctionArgs, useLoaderData, useParams } from 'react-router-dom';
import { Empty } from '../components/Empty';

import { useState } from 'react';
import { ApiTypes } from '../api/types';
import { AvatarWithLetters } from '../components/AvatarWithLetters';
import { QDialogConfirmDelete } from '../components/QDialog';
import { ROUTES } from '../constants/routes';
import { AccessSchema } from '../permissions';
import { DashboardHeader } from './components/DashboardHeader';
import { TeamShareMenu } from './components/TeamShareMenu';
import { data } from './team-1-mock-data';

export const loader = async ({ request, params }: LoaderFunctionArgs) => {
  return data;
};

export const Component = () => {
  const theme = useTheme();
  const [showDeleteDialog, setShowDeleteDialog] = useState<boolean>(false);
  const { team } = useLoaderData() as ApiTypes['/v0/teams/:uuid.GET.response'];
  const [showMembers, setShowMembers] = useState<boolean>(false);

  return (
    <>
      <DashboardHeader
        title={team.name}
        titleStart={
          <AvatarWithLetters size="large" src={team.picture}>
            {team.name}
          </AvatarWithLetters>
        }
        titleEnd={<EditDropdownMenu setShowDeleteDialog={setShowDeleteDialog} />}
        actions={
          <>
            <Button startIcon={<PeopleAltOutlined />} variant="outlined" onClick={() => setShowMembers(true)}>
              {team.users.length}
            </Button>
            <Button variant="contained" disableElevation>
              TODO Create file
            </Button>
          </>
        }
      />

      <Box sx={{ p: theme.spacing(2), textAlign: 'center' }}>Team files</Box>

      {showMembers && <TeamShareMenu onClose={() => setShowMembers(false)} team={team} />}
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
  const { permissions } = useLoaderData() as ApiTypes['/v0/teams/:uuid.GET.response'];
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const open = Boolean(anchorEl);
  const handleClick = (event: React.MouseEvent<HTMLElement>) => {
    setAnchorEl(event.currentTarget);
  };
  const handleClose = () => {
    setAnchorEl(null);
  };

  if (!permissions.access.includes(AccessSchema.enum.TEAM_EDIT)) {
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
        <MenuItem component={Link} to={ROUTES.EDIT_TEAM(uuid)}>
          Edit
        </MenuItem>
        <MenuItem
          onClick={() => {
            console.log(uuid);
          }}
        >
          Rename
        </MenuItem>
        <MenuItem onClick={() => {}}>Change avatar</MenuItem>
        {permissions.access.includes(AccessSchema.enum.TEAM_BILLING_EDIT) && (
          <MenuItem key={2} onClick={handleClose}>
            Edit billing
          </MenuItem>
        )}
        {permissions.access.includes(AccessSchema.enum.TEAM_DELETE) && [
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
