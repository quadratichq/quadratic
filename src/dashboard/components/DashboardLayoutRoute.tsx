import { Avatar, Box, CircularProgress, Typography, useTheme } from '@mui/material';
import { FileIcon, PersonIcon, StarIcon } from '@radix-ui/react-icons';
import clsx from 'clsx';
import { ReactNode, useEffect, useState } from 'react';
import { NavLink, Outlet, useLocation, useNavigation } from 'react-router-dom';
import { ROUTES } from '../../constants/routes';
import { useRootRouteLoaderData } from '../../router';
import { Button } from '../../shadcn/ui/button';
import { Sheet, SheetContent, SheetTrigger } from '../../shadcn/ui/sheet';
import QuadraticLogo from './quadratic-logo.svg';
import QuadraticLogotype from './quadratic-logotype.svg';

const drawerWidth = 264;

export const Component = () => {
  const navigation = useNavigation();
  const location = useLocation();
  const isLoading = navigation.state !== 'idle';
  const [isOpen, setIsOpen] = useState<boolean>(false);

  const navbar = <Navbar />;

  // When the location changes, close the menu (if it's already open)
  useEffect(() => {
    setIsOpen((prevIsOpen) => (prevIsOpen ? false : prevIsOpen));
  }, [location.pathname]);

  return (
    <div className={`h-full lg:flex lg:flex-row`}>
      <div className={`hidden flex-shrink-0 border-r border-r-border lg:block`} style={{ width: drawerWidth }}>
        {navbar}
      </div>
      {/* <Drawer
        variant="temporary"
        open={isOpen}
        onClose={toggleNavbar}
        anchor={'right'}
        ModalProps={{
          keepMounted: true, // Better open performance on mobile.
        }}
        sx={{
          borderRight: 'none',
          display: { xs: 'block', md: 'none' },
          '& .MuiDrawer-paper': { boxSizing: 'border-box', width: drawerWidth },
        }}
      >
        {navbar}
      </Drawer>
      <div className={` w-[264px] w-[${drawerWidth}px]`}>
        <Drawer
          variant="permanent"
          className={`border-r border-border`}
          sx={{
            display: { xs: 'none', md: 'block' },
            '& .MuiDrawer-paper': {
              boxSizing: 'border-box',
              width: drawerWidth,
              borderRight: `none`,
              // This is a fix where MUI and shadcn clash. Once we remove mui, we can remove this
              zIndex: '49',
            },
          }}
          open
        >
          {navbar}
        </Drawer>
      </div> */}
      <div
        className={clsx(
          `h-full w-full px-4 pb-10 transition-opacity lg:px-10`,
          isLoading ? 'overflow-hidden' : 'overflow-scroll',
          isLoading && 'pointer-events-none opacity-25'
        )}

        // sx={{
        //   width: '100%',
        //   height: '100%',
        //   px: theme.spacing(2),
        //   overflow: isLoading ? 'hidden' : 'scroll',
        //   paddingBottom: theme.spacing(5),
        //   position: 'relative',
        //   transition: '.2s ease opacity',
        //   ...(isLoading ? { opacity: '.25', pointerEvents: 'none' } : {}),

        //   [theme.breakpoints.up('md')]: {
        //     px: theme.spacing(5),
        //   },
        // }}
      >
        <div className={`absolute right-4 top-3 z-10 lg:hidden`}>
          <Sheet open={isOpen} onOpenChange={setIsOpen}>
            <SheetTrigger asChild>
              <Button variant="outline" onClick={() => setIsOpen(true)}>
                Menu
              </Button>
            </SheetTrigger>
            <SheetContent className="p-0" style={{ width: drawerWidth }}>
              {navbar}
            </SheetContent>
          </Sheet>
        </div>
        <Outlet />
      </div>
    </div>
  );
};

function Navbar() {
  const { user } = useRootRouteLoaderData();

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
              <img src={QuadraticLogo} />
            </div>
            <img src={QuadraticLogotype} />
            {/* <QuadraticLogotype /> */}
          </SidebarNavLink>
        </Box>

        <div className="mt-4 grid gap-1">
          <SidebarNavLink to={ROUTES.MY_FILES} style={sidebarLinkStyles}>
            <FileIcon className="h-5 w-5" />
            <Typography variant="body2" color="text.primary">
              My files
            </Typography>
          </SidebarNavLink>
          <SidebarNavLink to={ROUTES.EXAMPLES} style={sidebarLinkStyles}>
            <StarIcon className="h-5 w-5" />
            <Typography variant="body2" color="text.primary">
              Examples
            </Typography>
          </SidebarNavLink>
        </div>

        <SidebarLabel>Teams</SidebarLabel>
        <SidebarNavLink to={ROUTES.TEAMS} style={sidebarLinkStyles}>
          <PersonIcon className="h-5 w-5" />
          <Typography variant="body2" color="text.primary">
            My team
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

  const isActive =
    // We're currently on this page and not navigating elsewhere
    (to === location.pathname && navigation.state !== 'loading') ||
    // We're navigating to this page
    to === navigation.location?.pathname;

  return (
    <NavLink to={to} style={{ ...style, position: 'relative' }} className={`${isActive && 'bg-muted'} hover:bg-accent`}>
      {children}
      {navigation.state === 'loading' && navigation.location.pathname.includes(to) && !isLogo && (
        <CircularProgress size={18} sx={{ ml: 'auto' }} />
      )}
    </NavLink>
  );
}
