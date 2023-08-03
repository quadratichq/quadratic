import { Close, FilterDramaOutlined, Logout, Menu, PeopleOutline, SchoolOutlined } from '@mui/icons-material';
import { Avatar, Box, ButtonBase, CircularProgress, Drawer, IconButton, Typography, useTheme } from '@mui/material';
import { ReactNode, useEffect, useState } from 'react';
import { NavLink, Outlet, useFetcher, useLocation, useNavigation, useRouteLoaderData } from 'react-router-dom';
import { colors } from 'theme/colors';
import { RootLoaderData } from '../../routes';
import { ReactComponent as QuadraticLogo } from './quadratic-logo.svg';
import { ReactComponent as QuadraticLogotype } from './quadratic-logotype.svg';

const drawerWidth = 264;

export const Component = () => {
  const theme = useTheme();
  const navigation = useNavigation();
  const location = useLocation();
  const isLoading = navigation.state === 'loading';
  const [isOpen, setIsOpen] = useState<boolean>(false);

  const handleDrawerToggle = () => {
    setIsOpen((prev) => !prev);
  };

  const navbar = <Navbar handleDrawerToggle={handleDrawerToggle} />;

  // When the location changes, close the menu (if it's already open)
  useEffect(() => {
    setIsOpen((prevIsOpen) => (prevIsOpen ? false : prevIsOpen));
  }, [location.pathname]);

  return (
    <Box
      sx={{
        backgroundColor: theme.palette.background.default,
        height: '100%',
        [theme.breakpoints.up('md')]: {
          display: 'flex',
          ml: drawerWidth + 'px',
        },
      }}
    >
      <Drawer
        variant="temporary"
        open={isOpen}
        onClose={handleDrawerToggle}
        anchor={'right'}
        ModalProps={{
          keepMounted: true, // Better open performance on mobile.
        }}
        sx={{
          display: { xs: 'block', md: 'none' },
          '& .MuiDrawer-paper': { boxSizing: 'border-box', width: drawerWidth },
        }}
      >
        {navbar}
      </Drawer>
      <Drawer
        variant="permanent"
        sx={{
          display: { xs: 'none', md: 'block' },
          '& .MuiDrawer-paper': { boxSizing: 'border-box', width: drawerWidth },
        }}
        open
      >
        {navbar}
      </Drawer>
      <Box
        sx={{
          width: '100%',
          height: '100%',
          px: theme.spacing(2),
          overflow: isLoading ? 'hidden' : 'scroll',
          paddingBottom: theme.spacing(5),
          position: 'relative',
          transition: '.2s ease opacity',
          ...(isLoading ? { opacity: '.25', pointerEvents: 'none' } : {}),

          [theme.breakpoints.up('md')]: {
            px: theme.spacing(5),
          },
        }}
      >
        <Box
          sx={{
            display: { xs: 'block', md: 'none' },
            position: 'absolute',
            top: theme.spacing(1.5),
            right: theme.spacing(2),
            zIndex: 100,
          }}
        >
          <IconButton onClick={handleDrawerToggle}>
            <Menu />
          </IconButton>
        </Box>
        <Outlet />
      </Box>
    </Box>
  );
};

function Navbar({ handleDrawerToggle }: { handleDrawerToggle: Function }) {
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
        px: theme.spacing(2),
        py: theme.spacing(0.5),
        display: 'flex',
        justifyContent: 'space-between',
        flexDirection: 'column',
        height: '100%',

        [theme.breakpoints.up('md')]: {
          p: theme.spacing(2),
        },
      }}
    >
      <div style={{ display: 'flex', flexDirection: 'column' }}>
        <Box sx={sidebarLinkStyles}>
          <div style={{ width: '24px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <QuadraticLogo />
          </div>
          <QuadraticLogotype fill={theme.palette.mode === 'light' ? colors.darkGray : '#fff'} />

          <Box sx={{ marginLeft: 'auto', [theme.breakpoints.up('md')]: { display: 'none' } }}>
            <IconButton onClick={() => handleDrawerToggle()}>
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
