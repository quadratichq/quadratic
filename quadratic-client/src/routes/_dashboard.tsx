import { apiClient } from '@/api/apiClient';
import { useCheckForAuthorizationTokenOnWindowFocus } from '@/auth';
import { AvatarTeam } from '@/components/AvatarTeam';
import { Type } from '@/components/Type';
import { TYPE } from '@/constants/appConstants';
import { DOCUMENTATION_URL } from '@/constants/urls';
import { Action as FileAction } from '@/routes/files.$uuid';
import { TeamAction } from '@/routes/teams.$uuid';
import { Avatar, AvatarFallback } from '@/shadcn/ui/avatar';
import { Button } from '@/shadcn/ui/button';
import { Separator } from '@/shadcn/ui/separator';
import { Sheet, SheetContent, SheetTrigger } from '@/shadcn/ui/sheet';
import { cn } from '@/shadcn/utils';
import { CircularProgress } from '@mui/material';
import { AvatarImage } from '@radix-ui/react-avatar';
import { ExternalLinkIcon, FileIcon, HamburgerMenuIcon, MixIcon, PlusIcon, Share2Icon } from '@radix-ui/react-icons';
import { ApiTypes } from 'quadratic-shared/typesAndSchemas';
import { ReactNode, useEffect, useRef, useState } from 'react';
import {
  Link,
  NavLink,
  Outlet,
  useFetchers,
  useLoaderData,
  useLocation,
  useNavigation,
  useSubmit,
} from 'react-router-dom';
import { ROUTES } from '../constants/routes';
import QuadraticLogo from '../dashboard/components/quadratic-logo.svg';
import QuadraticLogotype from '../dashboard/components/quadratic-logotype.svg';
import { useRootRouteLoaderData } from '../router';

const drawerWidth = 264;

export const loader = async (): Promise<ApiTypes['/v0/teams.GET.response']> => {
  const data = await apiClient.teams.list();
  return data;
};

export const Component = () => {
  const navigation = useNavigation();
  const location = useLocation();
  const isLoading = navigation.state !== 'idle';
  const [isOpen, setIsOpen] = useState<boolean>(false);
  const contentPaneRef = useRef<HTMLDivElement>(null);

  const navbar = <Navbar />;

  // When the location changes, close the menu (if it's already open) and reset scroll
  useEffect(() => {
    setIsOpen((prevIsOpen) => (prevIsOpen ? false : prevIsOpen));
    if (contentPaneRef.current) contentPaneRef.current.scrollTop = 0;
  }, [location.pathname]);

  // Ensure long-running browser sessions still have a token
  useCheckForAuthorizationTokenOnWindowFocus();

  return (
    <div className={`h-full lg:flex lg:flex-row`}>
      <div
        ref={contentPaneRef}
        className={cn(
          `transition-filter relative order-2 h-full w-full px-4 pb-10 transition-opacity sm:pt-0 lg:px-10`,
          isLoading ? 'overflow-hidden' : 'overflow-scroll',
          isLoading && 'pointer-events-none opacity-25'
        )}
      >
        <div
          className={`sticky top-0 z-50 -mx-4 flex min-h-14 items-center justify-between border-b border-border bg-background px-4 lg:hidden`}
        >
          <Link to={'/'} className={`flex items-center gap-2`}>
            <div className={`flex w-5 items-center justify-center`}>
              <img src={QuadraticLogo} alt="Quadratic logo glyph" />
            </div>
            <img src={QuadraticLogotype} alt="Quadratic logotype" />
          </Link>
          <Sheet open={isOpen} onOpenChange={setIsOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" onClick={() => setIsOpen(true)}>
                <HamburgerMenuIcon />
              </Button>
            </SheetTrigger>
            <SheetContent className="p-0" style={{ width: drawerWidth }}>
              {navbar}
            </SheetContent>
          </Sheet>
        </div>
        <Outlet />
      </div>
      <div className={`order-1 hidden flex-shrink-0 border-r border-r-border lg:block`} style={{ width: drawerWidth }}>
        {navbar}
      </div>
    </div>
  );
};

function Navbar() {
  const {
    teams,
    userMakingRequest: { id: ownerUserId },
  } = useLoaderData() as ApiTypes['/v0/teams.GET.response'];
  const { loggedInUser: user } = useRootRouteLoaderData();
  const fetchers = useFetchers();
  const navigation = useNavigation();
  const classNameIcons = `mx-1 text-muted-foreground`;

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

        <div className="grid gap-0.5">
          <SidebarNavLink to={ROUTES.FILES} dropTarget={{ type: 'user', id: ownerUserId }}>
            <FileIcon className={classNameIcons} />
            Mine
          </SidebarNavLink>
          <SidebarNavLink to={ROUTES.FILES_SHARED_WITH_ME}>
            <Share2Icon className={classNameIcons} />
            Shared with me
          </SidebarNavLink>
          <SidebarNavLink to={ROUTES.EXAMPLES}>
            <MixIcon className={classNameIcons} />
            Examples
          </SidebarNavLink>
        </div>

        <Type
          as="h3"
          className={`${TYPE.overline} mb-2 mt-6 flex items-baseline justify-between indent-2 text-muted-foreground`}
        >
          Teams
        </Type>
        <div className="grid gap-0.5">
          {teams.map(({ team: { id: ownerTeamId, uuid, name, picture }, userMakingRequest: { teamPermissions } }) => {
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
              <SidebarNavLink
                key={uuid}
                to={ROUTES.TEAM(uuid)}
                dropTarget={teamPermissions.includes('TEAM_EDIT') ? { type: 'team', id: ownerTeamId } : undefined}
              >
                <AvatarTeam className={`-my-0.5 h-6 w-6`} src={picture} />
                {name}
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
          <ExternalLinkIcon className={cn(classNameIcons, `text-inherit opacity-50`)} />
          Docs
        </SidebarNavLink>
        <Separator className="my-2" />
        <SidebarNavLink to={ROUTES.ACCOUNT}>
          <Avatar className="h-6 w-6 bg-muted text-muted-foreground">
            <AvatarImage src={user?.picture} />
            <AvatarFallback>{user && user.name ? user.name[0] : '?'}</AvatarFallback>
          </Avatar>

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
  dropTarget,
  isLogo,
  target,
}: {
  to: string;
  children: ReactNode;
  className?: string;
  dropTarget?: {
    type: 'user' | 'team';
    id: number;
  };
  isLogo?: boolean;
  target?: string;
}) {
  const location = useLocation();
  const navigation = useNavigation();
  const submit = useSubmit();
  const [isDraggingOver, setIsDraggingOver] = useState(false);

  const isActive =
    // We're currently on this page and not navigating elsewhere
    (to === location.pathname && navigation.state !== 'loading') ||
    // We're navigating to this page
    to === navigation.location?.pathname;

  const isDroppable = dropTarget && to !== location.pathname;
  const dropProps = isDroppable
    ? {
        onDragLeave: (event: React.DragEvent<HTMLAnchorElement>) => {
          setIsDraggingOver(false);
        },
        onDragOver: (event: React.DragEvent<HTMLAnchorElement>) => {
          if (!event.dataTransfer.types.includes('application/quadratic-file-uuid')) return;

          event.preventDefault();
          event.dataTransfer.dropEffect = 'move';
          setIsDraggingOver(true);
        },
        onDrop: async (event: React.DragEvent<HTMLAnchorElement>) => {
          if (!event.dataTransfer.types.includes('application/quadratic-file-uuid')) return;

          event.preventDefault();
          const uuid = event.dataTransfer.getData('application/quadratic-file-uuid');
          setIsDraggingOver(false);
          const data: FileAction['request.move'] = {
            action: 'move',
            ...(dropTarget.type === 'user' ? { ownerUserId: dropTarget.id } : { ownerTeamId: dropTarget.id }),
          };
          submit(data, {
            method: 'POST',
            action: `/files/${uuid}`,
            encType: 'application/json',
            navigate: false,
            fetcherKey: `move-file:${uuid}`,
          });
        },
      }
    : {};

  return (
    <NavLink
      {...(target ? { target } : {})}
      to={to}
      className={cn(
        isActive && !isLogo && 'bg-muted',
        isDraggingOver && 'bg-primary text-primary-foreground',
        TYPE.body2,
        `relative flex items-center gap-2 p-2 no-underline hover:bg-accent`,
        className
      )}
      {...dropProps}
    >
      {children}
    </NavLink>
  );
}
