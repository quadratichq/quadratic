import { Close, FilterDramaOutlined, Logout, PeopleOutline, SchoolOutlined } from '@mui/icons-material';
import { Avatar, Box, ButtonBase, CircularProgress, IconButton, Typography, useTheme } from '@mui/material';
import { ReactNode } from 'react';
import { NavLink, Outlet, useFetcher, useLocation, useNavigation, useRouteLoaderData } from 'react-router-dom';
import { colors } from 'theme/colors';
import { RootLoaderData } from '../../routes';
import { ReactComponent as QuadraticLogo } from './quadratic-logo.svg';
import { ReactComponent as QuadraticLogotype } from './quadratic-logotype.svg';

export const Component = () => {
  const theme = useTheme();
  const navigation = useNavigation();
  const isLoading = navigation.state === 'loading';

  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: '264px 1fr',
        height: '100%',
        backgroundColor: theme.palette.background.default,
      }}
    >
      <Navbar />
      <div
        style={{
          padding: `0 ${theme.spacing(5)}`,
          overflow: isLoading ? 'hidden' : 'scroll',
          paddingBottom: theme.spacing(5),
          position: 'relative',
          transition: '.2s ease opacity',
          ...(isLoading ? { opacity: '.25', pointerEvents: 'none' } : {}),
        }}
      >
        <Outlet />
      </div>
    </div>
  );
};

function Navbar() {
  const { user } = useRouteLoaderData('root') as RootLoaderData;
  const fetcher = useFetcher();
  const theme = useTheme();

  const sidebarLinkStyles = {
    display: 'flex',
    alignItems: 'center',
    color: 'inherit',
    gap: theme.spacing(1),
    padding: `${theme.spacing(1)} ${theme.spacing(1)}`,
    textDecoration: 'none',
  };
  const SidebarLabel = ({ children }: { children: ReactNode }) => (
    <Typography variant="overline" color="text.secondary" style={{ marginTop: theme.spacing(2) }}>
      {children}
    </Typography>
  );

  return (
    <Box
      component="nav"
      sx={{
        [theme.breakpoints.up('md')]: {
          borderRight: `1px solid ${theme.palette.divider}`,
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
            ...sidebarLinkStyles,
            [theme.breakpoints.up('md')]: {
              // mb: theme.spacing(3),
            },
          }}
        >
          <div style={{ width: '24px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <QuadraticLogo />
          </div>
          <QuadraticLogotype fill={theme.palette.mode === 'light' ? colors.darkGray : '#fff'} />

          <Box sx={{ marginLeft: 'auto', [theme.breakpoints.up('md')]: { display: 'none' } }}>
            <IconButton>
              <Close />
            </IconButton>
          </Box>
        </Box>

        <SidebarLabel>Personal</SidebarLabel>
        <SidebarNavLink to="/files/mine" style={sidebarLinkStyles}>
          <FilterDramaOutlined color="primary" />
          <Typography variant="body2" color="text.primary">
            My files
          </Typography>
        </SidebarNavLink>
        <SidebarNavLink to="/files/examples" style={sidebarLinkStyles}>
          <SchoolOutlined color="primary" />
          <Typography variant="body2" color="text.primary">
            Example files
          </Typography>
        </SidebarNavLink>

        <SidebarLabel>Teams</SidebarLabel>
        <SidebarNavLink to="/files/teams" style={sidebarLinkStyles}>
          <PeopleOutline color="disabled" />
          <Typography variant="body2" color="text.secondary">
            Coming soon…
          </Typography>
        </SidebarNavLink>
      </div>
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        <SidebarLabel>Account</SidebarLabel>
        <SidebarNavLink to="/account" style={sidebarLinkStyles}>
          <Avatar alt={user?.name} src={user?.picture} sx={{ width: 24, height: 24 }} />
          <Typography variant="body2" color="text.primary">
            {user?.name || 'You'}
          </Typography>
        </SidebarNavLink>
        <fetcher.Form method="post" action="/logout" style={{ color: theme.palette.text.secondary }}>
          <ButtonBase type="submit" style={sidebarLinkStyles}>
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

function SidebarNavLink({ to, children, style }: any) {
  const location = useLocation();
  const navigation = useNavigation();
  const theme = useTheme();

  const isActive =
    // We're currently on this page and not navigating elsewhere
    (to === location.pathname && navigation.state === 'idle') ||
    // We're navigating to this page
    to === navigation.location?.pathname;

  return (
    <NavLink to={to} style={{ ...style, position: 'relative' }}>
      {isActive && (
        <div
          style={{
            position: 'absolute',
            top: '0',
            left: '0',
            right: '0',
            bottom: '0',
            backgroundColor: theme.palette.primary.light,
            opacity: '.14',
          }}
        />
      )}
      {children}
      {navigation.state === 'loading' && navigation.location.pathname.includes(to) && (
        <CircularProgress size={18} sx={{ ml: 'auto' }} />
      )}
    </NavLink>
  );
}
