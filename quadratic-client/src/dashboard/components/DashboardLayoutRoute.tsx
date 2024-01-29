import { apiClient } from '@/api/apiClient';
import { AvatarWithLetters } from '@/components/AvatarWithLetters';
import { Type } from '@/components/Type';
import { TYPE } from '@/constants/appConstants';
import { DOCUMENTATION_URL } from '@/constants/urls';
import { TeamAction } from '@/routes/teams.$uuid';
import { Button } from '@/shadcn/ui/button';
import { Separator } from '@/shadcn/ui/separator';
import { Sheet, SheetContent, SheetTrigger } from '@/shadcn/ui/sheet';
import { cn } from '@/shadcn/utils';
import { Avatar, CircularProgress } from '@mui/material';
import { ExternalLinkIcon, FileIcon, MixIcon, PersonIcon, PlusIcon } from '@radix-ui/react-icons';
import * as Sentry from '@sentry/react';
import { ApiTypes } from 'quadratic-shared/typesAndSchemas';
import { ReactNode, useEffect, useState } from 'react';
import { NavLink, Outlet, useFetchers, useLoaderData, useLocation, useNavigation } from 'react-router-dom';
import { ROUTES } from '../../constants/routes';
import { useRootRouteLoaderData } from '../../router';
import QuadraticLogo from './quadratic-logo.svg';
import QuadraticLogotype from './quadratic-logotype.svg';

const drawerWidth = 264;

type LoaderData = {
  teams: ApiTypes['/v0/teams.GET.response'];
  hasError: boolean;
};

export const loader = async (): Promise<LoaderData> => {
  let hasError = false;
  const teams = await apiClient.teams.list().catch((err) => {
    Sentry.captureException(err);

    hasError = true;
    return [];
  });
  return { teams, hasError };
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
  const { teams, hasError } = useLoaderData() as LoaderData;
  const { loggedInUser: user } = useRootRouteLoaderData();
  const fetchers = useFetchers();
  const navigation = useNavigation();
  const classNameIcons = `h-5 w-5 mx-0.5`;

  return (
    <nav className={`flex h-full flex-col justify-between gap-4 overflow-auto px-4 pb-2 pt-4`}>
      <div className={`flex flex-col`}>
        <div className={`flex items-center lg:justify-between`}>
          <SidebarNavLink to="/files" className={`pr-3`} isLogo={true}>
            <div className={`flex w-5 items-center justify-center`}>
              <img src={QuadraticLogo} alt="Quadratic logo glyph" />
            </div>
            <img src={QuadraticLogotype} alt="Quadratic logotype" />
          </SidebarNavLink>
          {navigation.state === 'loading' && <CircularProgress size={18} className="mr-3" />}
        </div>

        <Type
          as="h3"
          variant="overline"
          className={`mb-2 mt-6 flex items-baseline justify-between indent-2 text-muted-foreground`}
        >
          Files
        </Type>

        <div className="grid gap-1">
          <SidebarNavLink to={ROUTES.FILES}>
            <FileIcon className={classNameIcons} />
            Mine
          </SidebarNavLink>
          <SidebarNavLink to={ROUTES.FILES_SHARED_WITH_ME}>
            <PersonIcon className={classNameIcons} />
            Shared with me
          </SidebarNavLink>
          <SidebarNavLink to={ROUTES.EXAMPLES}>
            <MixIcon className={classNameIcons} />
            Examples
          </SidebarNavLink>
        </div>

        {false && (
          <>
            <Type as="h3" className={`mb-2 mt-6 flex items-baseline justify-between indent-2 text-muted-foreground`}>
              <span className={`${TYPE.overline}`}>Teams</span>{' '}
              {hasError && (
                <span className="text-xs text-destructive">
                  Failed to load,{' '}
                  <a href="." className="underline">
                    refresh
                  </a>
                </span>
              )}
            </Type>
            <div className="grid gap-1">
              {teams.map(({ uuid, name, picture }) => {
                // TODO: can we refine this?
                // See if this team has an inflight fetcher that's updating team info
                const inFlightFetcher = fetchers.find(
                  (fetcher) =>
                    fetcher.state !== 'idle' &&
                    fetcher.formAction?.includes(uuid) &&
                    fetcher.json &&
                    typeof fetcher.json === 'object' &&
                    (fetcher.json as TeamAction['request.update-team']).intent === 'update-team'
                );
                // If it does, use its data
                if (inFlightFetcher) {
                  const data = inFlightFetcher.json as TeamAction['request.update-team'];
                  if (data.name) name = data.name;
                  if (data.picture) picture = data.picture;
                }

                return (
                  <SidebarNavLink key={uuid} to={ROUTES.TEAM(uuid)}>
                    <AvatarWithLetters size="small" src={picture}>
                      {name}
                    </AvatarWithLetters>
                    {name}
                  </SidebarNavLink>
                );
              })}
              <SidebarNavLink to={ROUTES.CREATE_TEAM}>
                <PlusIcon className={classNameIcons} />
                Create
              </SidebarNavLink>
            </div>
          </>
        )}
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
        isActive && !isLogo && 'bg-muted',
        TYPE.body2,
        `relative flex items-center gap-2 p-2 no-underline hover:bg-accent`,
        className
      )}
    >
      {children}
    </NavLink>
  );
}
