// import { useEffect } from 'react';
import { NavLink, useRouteLoaderData, Outlet, useLocation } from 'react-router-dom';

import { RootLoaderData } from './Routes';
import { Avatar, Typography, useTheme } from '@mui/material';
import { FilterDramaOutlined, KeyboardArrowDown, PeopleOutline, SchoolOutlined } from '@mui/icons-material';
import { colors } from './theme/colors';
// import { useGlobalSnackbar } from './ui/contexts/GlobalSnackbar';

// type ActionData = {
//   deleteSuccess: boolean;
//   dt: number;
// };

export const Component = () => {
  const theme = useTheme();
  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: '264px 1fr',
        backgroundColor: colors.canvasLayer1,
        height: '100%',
      }}
    >
      <Navbar />
      <div style={{ padding: theme.spacing(2), overflow: 'scroll' }}>
        <Outlet />
      </div>
    </div>
  );
};

function Navbar() {
  const { user } = useRouteLoaderData('root') as RootLoaderData;
  const location = useLocation();
  console.log(location);
  const theme = useTheme();
  const linkStylesFn = ({ isActive }: { isActive: boolean }) => ({
    padding: theme.spacing(1) + ' ' + theme.spacing(2),
    color: 'inherit',
    textDecoration: 'none',
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing(1),
    backgroundColor: isActive ? colors.canvasLayer3 : 'transparent',
  });
  const labelStyles = {
    marginTop: theme.spacing(1),
    padding: theme.spacing(0.5) + ' ' + theme.spacing(2),
  };
  return (
    <nav style={{ borderRight: `1px solid ${colors.mediumGray}` }}>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: theme.spacing(1),
          padding: `${theme.spacing(1)} ${theme.spacing(2)}`,
          borderBottom: `1px solid ${colors.mediumGray}`,
        }}
      >
        <Avatar alt={user?.name} src={user?.picture} sx={{ width: 24, height: 24 }} />
        <div style={{ display: 'flex', flexDirection: 'column', flexGrow: '2' }}>
          <Typography variant="subtitle2" sx={{ marginBottom: theme.spacing(-0.5) }}>
            {user?.name}
          </Typography>
          <Typography variant="caption" color="text.secondary">
            {user?.email}
          </Typography>
        </div>
        <KeyboardArrowDown fontSize="small" color="disabled" />
      </div>
      <div style={{ display: 'flex', flexDirection: 'column' }}>
        <Typography variant="overline" color="text.secondary" style={labelStyles}>
          Personal
        </Typography>

        <NavLink to="/files/mine" style={linkStylesFn}>
          <FilterDramaOutlined color="primary" /> <Typography variant="body2">My files</Typography>
        </NavLink>
        <NavLink to="/files/examples" style={linkStylesFn}>
          <SchoolOutlined color="primary" /> <Typography variant="body2">Example files</Typography>
        </NavLink>
        <Typography variant="overline" color="text.secondary" style={labelStyles}>
          Teams
        </Typography>
        <NavLink to="/files/teams" style={linkStylesFn}>
          <PeopleOutline color="disabled" />{' '}
          <Typography variant="body2" color="text.disabled">
            Coming soon…
          </Typography>
        </NavLink>
      </div>
    </nav>
  );
}
