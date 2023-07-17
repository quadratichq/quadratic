// import { useEffect } from 'react';
import { NavLink, Outlet, useFetcher, useRouteLoaderData } from 'react-router-dom';
import { RootLoaderData } from './Routes';
import { Avatar, Box, ButtonBase, IconButton, Typography, useTheme } from '@mui/material';
import { Close, FilterDramaOutlined, Logout, PeopleOutline, SchoolOutlined } from '@mui/icons-material';
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
        height: '100%',
      }}
    >
      <Navbar />
      <div style={{ padding: `0 ${theme.spacing(5)}`, overflow: 'scroll', paddingBottom: theme.spacing(5) }}>
        <Outlet />
      </div>
    </div>
  );
};

function Navbar() {
  const { user } = useRouteLoaderData('root') as RootLoaderData;
  const fetcher = useFetcher();
  const theme = useTheme();
  const linkStylesFn = ({ isActive }: { isActive: boolean }) => ({
    padding: `${theme.spacing(1)} ${theme.spacing(1)}`,
    color: 'inherit',
    textDecoration: 'none',
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing(1),
    // 14 = hex alpha opacity (TODO move into colors or custom theme)
    backgroundColor: isActive ? theme.palette.primary.light + '14' : 'transparent',
  });
  const labelStyles = {
    marginTop: theme.spacing(2),
  };
  return (
    <Box
      component="nav"
      sx={{
        [theme.breakpoints.up('md')]: {
          borderRight: `1px solid ${colors.mediumGray}`,
        },
        padding: theme.spacing(2),
        display: 'flex',
        justifyContent: 'space-between',
        flexDirection: 'column',
      }}
    >
      <div style={{ display: 'flex', flexDirection: 'column' }}>
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',

            [theme.breakpoints.up('md')]: {
              // mb: theme.spacing(3),
              padding: `${theme.spacing(1)} 0`,
            },
          }}
        >
          <img src="/images/quadratic-logo.svg" alt="Quadratic logo" height="22" />
          <Box sx={{ [theme.breakpoints.up('md')]: { display: 'none' } }}>
            <IconButton>
              <Close />
            </IconButton>
          </Box>
        </Box>
        <Typography variant="overline" color="text.secondary" style={labelStyles}>
          Personal
        </Typography>

        <NavLink to="/files/mine" style={linkStylesFn}>
          <FilterDramaOutlined color="primary" />{' '}
          <Typography variant="body2" color="text.primary">
            My files
          </Typography>
        </NavLink>
        <NavLink to="/files/examples" style={linkStylesFn}>
          <SchoolOutlined color="primary" />{' '}
          <Typography variant="body2" color="text.primary">
            Example files
          </Typography>
        </NavLink>
        <Typography variant="overline" color="text.secondary" style={labelStyles}>
          Teams (Coming Soon)
        </Typography>
        <NavLink to="/files/teams" style={linkStylesFn}>
          <PeopleOutline color="primary" />{' '}
          <Typography variant="body2" color="text.primary">
            My Team
          </Typography>
        </NavLink>
      </div>
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        <Typography variant="overline" color="text.secondary" style={labelStyles}>
          Account
        </Typography>
        <NavLink to="/account" style={linkStylesFn}>
          <Avatar alt={user?.name} src={user?.picture} sx={{ width: 24, height: 24 }} />
          <Typography variant="body2">{user?.name || 'You'}</Typography>
        </NavLink>
        <fetcher.Form method="post" action="/logout" style={{ color: theme.palette.text.secondary }}>
          <ButtonBase type="submit" style={linkStylesFn({ isActive: false })}>
            <Logout color="inherit" />
            <Typography variant="body2" color="inherit">
              Log out
            </Typography>
          </ButtonBase>
        </fetcher.Form>
      </div>
    </Box>
  );
}
