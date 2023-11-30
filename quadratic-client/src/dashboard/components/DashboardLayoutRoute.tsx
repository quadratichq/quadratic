import { apiClient } from '@/api/apiClient';
import { AvatarWithLetters } from '@/components/AvatarWithLetters';
import { TYPE } from '@/constants/appConstants';
import { DOCUMENTATION_URL } from '@/constants/urls';
import { Button } from '@/shadcn/ui/button';
import { Separator } from '@/shadcn/ui/separator';
import { Sheet, SheetContent, SheetTrigger } from '@/shadcn/ui/sheet';
import { cn } from '@/shadcn/utils';
import { Avatar, CircularProgress } from '@mui/material';
import { ApiTypes } from '@quadratic-shared/typesAndSchemas';
import { ExternalLinkIcon, FileIcon, MixIcon, PlusIcon } from '@radix-ui/react-icons';
import { ReactNode, useEffect, useState } from 'react';
import { NavLink, Outlet, useFetchers, useLoaderData, useLocation, useNavigation, useParams } from 'react-router-dom';
import { ROUTES } from '../../constants/routes';
import { useRootRouteLoaderData } from '../../router';
import QuadraticLogo from './quadratic-logo.svg';
import QuadraticLogotype from './quadratic-logotype.svg';

const drawerWidth = 264;

type LoaderData = ApiTypes['/v0/teams.GET.response'];

export const loader = async () => {
  // TODO what if this fails? How should we handle that for routes
  const teams = await apiClient.getTeams().catch((err) => {
    console.log(err);
    return [];
  });
  return teams;
};

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
  const teams = useLoaderData() as LoaderData;
  const { user } = useRootRouteLoaderData();
  const { teamUuid } = useParams();

  const fetchers = useFetchers();
  const inFlightTeamFetcher = fetchers.find((fetcher) => fetcher.formAction?.startsWith(`/teams/${teamUuid}`));

  const classNameIcons = `h-5 w-5 mx-0.5`;

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
          <SidebarNavLink to={ROUTES.FILES}>
            <FileIcon className={classNameIcons} />
            My files
          </SidebarNavLink>
          <SidebarNavLink to={ROUTES.EXAMPLES}>
            <MixIcon className={classNameIcons} />
            Examples
          </SidebarNavLink>
        </div>

        <p className={`${TYPE.overline} mb-2 mt-6 indent-2 text-muted-foreground`}>Teams</p>
        <div className="grid gap-1">
          {teams.map(({ uuid, name }: any) => {
            const teamName =
              // @ts-expect-error
              teamUuid === uuid && inFlightTeamFetcher?.json?.name
                ? // @ts-expect-error
                  inFlightTeamFetcher.json.name
                : name;

            return (
              <SidebarNavLink key={uuid} to={ROUTES.TEAM(uuid)}>
                <AvatarWithLetters size="small">{teamName}</AvatarWithLetters>
                {teamName}
              </SidebarNavLink>
            );
          })}
          <SidebarNavLink to={ROUTES.CREATE_TEAM}>
            <PlusIcon className={classNameIcons} />
            Create
          </SidebarNavLink>
        </div>
      </div>
      <div>
        <SidebarNavLink to={DOCUMENTATION_URL} target="_blank" className={`text-muted-foreground`}>
          Docs
          <ExternalLinkIcon className={cn(classNameIcons, `ml-auto text-inherit opacity-50`)} />
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
    </nav>
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
