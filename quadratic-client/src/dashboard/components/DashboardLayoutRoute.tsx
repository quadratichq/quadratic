import { TYPE } from '@/constants/appConstants';
import { DOCUMENTATION_URL } from '@/constants/urls';
import { useWindowsSizeGreaterThan } from '@/hooks/windowsSize';
import { Button } from '@/shadcn/ui/button';
import { Separator } from '@/shadcn/ui/separator';
import { Sheet, SheetContent, SheetTrigger } from '@/shadcn/ui/sheet';
import { cn } from '@/shadcn/utils';
import { Avatar, CircularProgress } from '@mui/material';
import { ExternalLinkIcon, FileIcon, MixIcon, PersonIcon, FilePlusIcon } from '@radix-ui/react-icons';
import { ReactNode, useEffect, useState } from 'react';
import { NavLink, Outlet, useLocation, useNavigation } from 'react-router-dom';
import { ROUTES } from '../../constants/routes';
import { useRootRouteLoaderData } from '../../router';
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
      <div
        className={cn(
          `relative h-full w-full px-4 pb-10 transition-opacity lg:px-10`,
          isLoading ? 'overflow-hidden' : 'overflow-scroll',
          isLoading && 'pointer-events-none opacity-25'
        )}
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
  const isBigScreen = useWindowsSizeGreaterThan("width", 1024);
  const hiddenClass = isBigScreen ? "display-none" : undefined;

  return (
    <nav className={`flex h-full flex-col justify-between px-4 pb-2 pt-4`}>
      <div style={{ display: 'flex', flexDirection: 'column' }}>
        <div className={`flex items-center justify-between`}>
          <SidebarNavLink to="/" className={`pr-3`} isLogo={true}>
            <div className={`flex w-5 items-center justify-center`}>
              <img src={QuadraticLogo} alt="Quadratic logo glyph" />
            </div>
            <img src={QuadraticLogotype} alt="Quadratic logotype" />
          </SidebarNavLink>
        </div>

        <div className="mt-4 grid gap-1">
          <SidebarNavLink className={hiddenClass} to={ROUTES.CREATE_FILE}>
            <FilePlusIcon className="h-5 w-5" />
            Create file
          </SidebarNavLink>
          <SidebarNavLink to={ROUTES.FILES}>
            <FileIcon className="h-5 w-5" />
            My files
          </SidebarNavLink>
          <SidebarNavLink to={ROUTES.EXAMPLES}>
            <MixIcon className="h-5 w-5" />
            Examples
          </SidebarNavLink>
        </div>

        <p className={`${TYPE.overline} mt-6 text-muted-foreground`}>Teams</p>
        <SidebarNavLink to={ROUTES.TEAMS}>
          <PersonIcon className="h-5 w-5" />
          My team
        </SidebarNavLink>
      </div>
      <div>
        <SidebarNavLink to={DOCUMENTATION_URL} target="_blank" className={`text-muted-foreground`}>
          Docs
          <ExternalLinkIcon className="ml-auto h-5 w-5 text-inherit opacity-50" />
        </SidebarNavLink>
        <Separator className="my-2" />
        <SidebarNavLink to={ROUTES.ACCOUNT}>
          <Avatar alt={user?.name} src={user?.picture} sx={{ width: 24, height: 24 }} />
          <div className={`flex flex-col overflow-hidden`}>
            {user?.name || 'You'}
            {user?.email && <p className={`truncate ${TYPE.caption} text-muted-foreground`}>{user?.email}</p>}
          </div>
        </SidebarNavLink>
      </div>
    </nav >
  );
}

function SidebarNavLink({
  to,
  children,
  className,
  isLogo,
  target,
}: {
  to: string;
  children: ReactNode;
  className?: string;
  isLogo?: boolean;
  target?: string;
}) {
  const location = useLocation();
  const navigation = useNavigation();

  const isActive =
    // We're currently on this page and not navigating elsewhere
    (to === location.pathname && navigation.state !== 'loading') ||
    // We're navigating to this page
    to === navigation.location?.pathname;

  return (
    <NavLink
      {...(target ? { target } : {})}
      to={to}
      className={cn(
        isActive && 'bg-muted',
        TYPE.body2,
        `relative flex items-center gap-2 p-2 no-underline hover:bg-accent`,
        className
      )}
    >
      {children}
      {navigation.state === 'loading' && navigation.location.pathname.includes(to) && !isLogo && (
        <CircularProgress size={18} sx={{ ml: 'auto' }} />
      )}
    </NavLink>
  );
}
