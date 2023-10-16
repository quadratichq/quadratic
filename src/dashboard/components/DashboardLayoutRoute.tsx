import { Add, Close, ExtensionOutlined, FolderOpenOutlined, Menu } from '@mui/icons-material';
import { Avatar, Box, CircularProgress, Drawer, IconButton, Typography, useTheme } from '@mui/material';
import { ReactNode, useEffect, useState } from 'react';
import { NavLink, Outlet, useLoaderData, useLocation, useNavigation } from 'react-router-dom';
import { ApiTypes } from '../../api/types';
import { AvatarWithLetters } from '../../components/AvatarWithLetters';
import { ROUTES } from '../../constants/routes';
import { useRootRouteLoaderData } from '../../router';
import { colors } from '../../theme/colors';
import { data } from '../team-1-mock-data';
import { ReactComponent as QuadraticLogo } from './quadratic-logo.svg';
import { ReactComponent as QuadraticLogotype } from './quadratic-logotype.svg';

const drawerWidth = 264;

type LoaderData = {
  teams: ApiTypes['/v0/teams/:uuid.GET.response'][];
};

export const loader = () => {
  return {
    teams: [data],
  };
};

export const Component = () => {
  const loaderData = useLoaderData() as LoaderData;
  const theme = useTheme();
  const navigation = useNavigation();
  const location = useLocation();
  const isLoading = navigation.state !== 'idle';
  const [isOpen, setIsOpen] = useState<boolean>(false);

  const handleDrawerToggle = () => {
    setIsOpen((prev) => !prev);
  };

  const navbar = <Navbar handleDrawerToggle={handleDrawerToggle} loaderData={loaderData} />;

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

function Navbar({ handleDrawerToggle, loaderData }: { handleDrawerToggle: Function; loaderData: LoaderData }) {
  const { user } = useRootRouteLoaderData();

  const theme = useTheme();

  const sidebarLinkStyles = {
    display: 'flex',
    alignItems: 'center',
    color: 'inherit',
    gap: theme.spacing(1),
    padding: `${theme.spacing(1)} ${theme.spacing(1)}`,
    borderBottom: '2px solid transparent',
    textDecoration: 'none',
    borderRadius: theme.shape.borderRadius,
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
        pt: theme.spacing(1.5),
        pb: theme.spacing(1),
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
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <SidebarNavLink to="/" style={{ ...sidebarLinkStyles, paddingRight: theme.spacing(1.5) }} isLogo={true}>
            <div style={{ width: '24px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <QuadraticLogo />
            </div>
            <QuadraticLogotype fill={theme.palette.mode === 'light' ? colors.quadraticFifth : '#fff'} />
          </SidebarNavLink>

          <Box sx={{ marginLeft: 'auto', [theme.breakpoints.up('md')]: { display: 'none' } }}>
            <IconButton onClick={() => handleDrawerToggle()}>
              <Close />
            </IconButton>
          </Box>
        </Box>

        <SidebarLabel>Personal</SidebarLabel>
        <SidebarNavLink to={ROUTES.MY_FILES} style={sidebarLinkStyles}>
          <FolderOpenOutlined />
          <Typography variant="body2" color="text.primary">
            My files
          </Typography>
        </SidebarNavLink>
        <SidebarNavLink to={ROUTES.EXAMPLES} style={sidebarLinkStyles}>
          <ExtensionOutlined />
          <Typography variant="body2" color="text.primary">
            Examples
          </Typography>
        </SidebarNavLink>

        <SidebarLabel>Teams</SidebarLabel>
        {loaderData.teams.map(({ team }) => (
          <SidebarNavLink key={team.uuid} to={ROUTES.TEAM(team.uuid)} style={sidebarLinkStyles}>
            <AvatarWithLetters size="small">{team.name}</AvatarWithLetters>
            <Typography variant="body2" color="text.primary">
              {team.name}
            </Typography>
          </SidebarNavLink>
        ))}
        <SidebarNavLink to={ROUTES.CREATE_TEAM} style={sidebarLinkStyles}>
          <Add />
          <Typography variant="body2" color="text.primary">
            Create
          </Typography>
        </SidebarNavLink>
      </div>
      <div>
        <SidebarNavLink to={ROUTES.ACCOUNT} style={sidebarLinkStyles}>
          <Avatar alt={user?.name} src={user?.picture} sx={{ width: 24, height: 24 }} />
          <div style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            <Typography variant="body2" color="text.primary">
              {user?.name || 'You'}
            </Typography>
            {user?.email && (
              <Typography noWrap variant="caption" color="text.secondary">
                {user?.email}
              </Typography>
            )}
          </div>
        </SidebarNavLink>
      </div>
    </Box>
  );
}

function SidebarNavLink({ to, children, style, isLogo }: any) {
  const location = useLocation();
  const navigation = useNavigation();
  const theme = useTheme();

  const isActive =
    // We're currently on this page and not navigating elsewhere
    (to === location.pathname && navigation.state !== 'loading') ||
    // We're navigating to this page
    to === navigation.location?.pathname;

  return (
    <Box
      sx={{
        '.MuiSvgIcon-root': {
          fill: theme.palette.text.secondary,
        },
        '&:hover .MuiSvgIcon-root': {
          fill: theme.palette.text.primary,
        },
      }}
    >
      <NavLink to={to} style={{ ...style, position: 'relative' }}>
        <Box
          sx={[
            {
              position: 'absolute',
              top: '0',
              left: '0',
              right: '0',
              bottom: '0',
              backgroundColor: isActive ? theme.palette.action.hover : 'inherit',

              '&:hover': {
                backgroundColor: theme.palette.action.hover,
              },
            },
          ]}
        />
        {children}
        {navigation.state === 'loading' && navigation.location.pathname.includes(to) && !isLogo && (
          <CircularProgress size={18} sx={{ ml: 'auto' }} />
        )}
      </NavLink>
    </Box>
  );
}
