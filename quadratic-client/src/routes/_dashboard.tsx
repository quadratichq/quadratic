import { useCheckForAuthorizationTokenOnWindowFocus } from '@/auth';
import { ConnectionsIcon } from '@/dashboard/components/CustomRadixIcons';
import { EducationDialog } from '@/dashboard/components/EducationDialog';
import { TeamSwitcher } from '@/dashboard/components/TeamSwitcher';
import { useRootRouteLoaderData } from '@/routes/_root';
import { getActionFileMove } from '@/routes/files.$uuid';
import { apiClient } from '@/shared/api/apiClient';
import { Type } from '@/shared/components/Type';
import { TYPE } from '@/shared/constants/appConstants';
import { ROUTES, ROUTE_LOADER_IDS, SEARCH_PARAMS } from '@/shared/constants/routes';
import { CONTACT_URL, DOCUMENTATION_URL } from '@/shared/constants/urls';
import { useTheme } from '@/shared/hooks/useTheme';
import { Avatar, AvatarFallback } from '@/shared/shadcn/ui/avatar';
import { Badge } from '@/shared/shadcn/ui/badge';
import { Button } from '@/shared/shadcn/ui/button';
import { Sheet, SheetContent, SheetTrigger } from '@/shared/shadcn/ui/sheet';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/shared/shadcn/ui/tooltip';
import { cn } from '@/shared/shadcn/utils';
import { LiveChatWidget } from '@livechat/widget-react';
import { SchoolOutlined } from '@mui/icons-material';
import { AvatarImage } from '@radix-ui/react-avatar';
import {
  ExternalLinkIcon,
  FileIcon,
  GearIcon,
  HamburgerMenuIcon,
  MixIcon,
  PersonIcon,
  PlusIcon,
  Share2Icon,
} from '@radix-ui/react-icons';
import * as Sentry from '@sentry/react';
import { ReactNode, createContext, useContext, useEffect, useRef, useState } from 'react';
import {
  Link,
  LoaderFunctionArgs,
  NavLink,
  Outlet,
  useLoaderData,
  useLocation,
  useNavigation,
  useParams,
  useRevalidator,
  useRouteLoaderData,
  useSearchParams,
  useSubmit,
} from 'react-router-dom';

const DRAWER_WIDTH = 264;
const ACTIVE_TEAM_UUID_KEY = 'activeTeamUuid';

/**
 * Dashboard state & context
 */
type DashboardState = {
  activeTeam: Awaited<ReturnType<typeof apiClient.teams.list>>['teams'][0];
};
const initialDashboardState: DashboardState = {
  // @ts-expect-error
  activeTeam: {},
};
const DashboardContext = createContext(initialDashboardState);
export const useDashboardContext = () => useContext(DashboardContext);

/**
 * Loader
 */
type LoaderData = Awaited<ReturnType<typeof loader>>;
export const loader = async ({ params }: LoaderFunctionArgs) => {
  let [{ teams, userMakingRequest }, { eduStatus }] = await Promise.all([
    apiClient.teams.list(),
    apiClient.education.get(),
  ]);

  let initialActiveTeam: ReturnType<typeof getTeam> = undefined;
  const uuidFromUrl = params.teamUuid;
  const uuidFromLocalStorage = localStorage.getItem(ACTIVE_TEAM_UUID_KEY);
  const getTeam = (teamUuid: string) => teams.find(({ team }) => team.uuid === teamUuid);

  // 1) Check the URL for a team UUID
  // FYI: if you have a UUID in the URL or localstorage, it doesn’t mean you
  // have acces to it (maybe you were removed from a team, so it’s a 404)
  // So we have to ensure we A) have a UUID, and B) it's in the list of teams
  // we have access to from the server.
  if (uuidFromUrl && getTeam(uuidFromUrl)) {
    initialActiveTeam = getTeam(uuidFromUrl);

    // 2) Check localstorage for a team UUID
  } else if (uuidFromLocalStorage && getTeam(uuidFromLocalStorage)) {
    initialActiveTeam = getTeam(uuidFromLocalStorage);

    // 3) there's no default preference (yet), so pick the 1st one in the API
  } else if (teams.length > 0) {
    initialActiveTeam = teams[0];

    // 4) there's no teams in the API, so create one
  } else if (teams.length === 0) {
    await apiClient.teams.create({ name: 'My team' });
    // refetch teams data after creating a new team
    const refreshedTeamsData = await apiClient.teams.list();
    teams = refreshedTeamsData.teams;
    userMakingRequest = refreshedTeamsData.userMakingRequest;
  }

  // This should never happen, but if it does, we'll log it to sentry
  if (initialActiveTeam === undefined) {
    Sentry.captureEvent({
      message: 'No active team was found or could be created.',
      level: 'fatal',
    });
    throw new Error('No active team could be found or created. Try reloading?');
  }

  return { teams, userMakingRequest, eduStatus, initialActiveTeam };
};
export const useDashboardRouteLoaderData = () => useRouteLoaderData(ROUTE_LOADER_IDS.DASHBOARD) as LoaderData;

/**
 * Component
 */
export const Component = () => {
  const params = useParams();
  const { teams, initialActiveTeam } = useLoaderData() as LoaderData;
  const [searchParams] = useSearchParams();
  const navigation = useNavigation();
  const location = useLocation();
  const [isOpen, setIsOpen] = useState<boolean>(false);
  const contentPaneRef = useRef<HTMLDivElement>(null);
  const revalidator = useRevalidator();
  const { loggedInUser: user } = useRootRouteLoaderData();
  const [activeTeam, setActiveTeam] = useState<LoaderData['initialActiveTeam']>(initialActiveTeam);
  const activeTeamUuid = activeTeam.team.uuid;

  // If the teamUuid changed in the URL (due to a navigation, created a new team, etc.)
  // Then update the app's currently active team
  useEffect(() => {
    const team = teams.find((data) => data.team.uuid === params.teamUuid);
    if (params.teamUuid && params.teamUuid !== activeTeamUuid && team) {
      console.warn('SWITCHED TEAM IN LOCAL STORAGE', params.teamUuid);
      localStorage.setItem(ACTIVE_TEAM_UUID_KEY, params.teamUuid);
      setActiveTeam(team);
    }
  }, [params.teamUuid, activeTeamUuid, teams]);

  const isLoading = revalidator.state !== 'idle' || navigation.state !== 'idle';
  const navbar = <Navbar isLoading={isLoading} />;

  // Trigger the theme in the root of the app
  useTheme();

  // When the location changes, close the menu (if it's already open) and reset scroll
  useEffect(() => {
    setIsOpen((prevIsOpen) => (prevIsOpen ? false : prevIsOpen));
    if (contentPaneRef.current) contentPaneRef.current.scrollTop = 0;
  }, [location.pathname]);

  // Ensure long-running browser sessions still have a token
  useCheckForAuthorizationTokenOnWindowFocus();

  return (
    <DashboardContext.Provider
      value={{
        activeTeam,
      }}
    >
      <LiveChatWidget license="14763831" customerEmail={user?.email} customerName={user?.name} />
      <div className={`h-full lg:flex lg:flex-row`}>
        <div
          ref={contentPaneRef}
          className={cn(
            `relative order-2 h-full w-full px-4 pb-10 transition-all sm:pt-0 lg:px-10`,
            isLoading ? 'overflow-hidden' : 'overflow-scroll',
            isLoading && 'pointer-events-none opacity-25'
          )}
        >
          <div className={`sticky top-0 z-50 -mx-4 flex items-center justify-end bg-background px-2 py-1 lg:hidden`}>
            <Sheet open={isOpen} onOpenChange={setIsOpen}>
              <SheetTrigger asChild>
                <Button variant="ghost" size="icon" onClick={() => setIsOpen(true)}>
                  <HamburgerMenuIcon />
                </Button>
              </SheetTrigger>
              <SheetContent className="p-0" style={{ width: DRAWER_WIDTH }}>
                {navbar}
              </SheetContent>
            </Sheet>
          </div>
          <Outlet />
        </div>
        <div
          className={`order-1 hidden flex-shrink-0 border-r border-r-border lg:block`}
          style={{ width: DRAWER_WIDTH }}
        >
          {navbar}
        </div>
        {searchParams.get(SEARCH_PARAMS.DIALOG.KEY) === SEARCH_PARAMS.DIALOG.VALUES.EDUCATION && <EducationDialog />}
      </div>
    </DashboardContext.Provider>
  );
};

/**
 * Dashboard Navbar
 */
function Navbar({ isLoading }: { isLoading: boolean }) {
  const [, setSearchParams] = useSearchParams();
  const {
    userMakingRequest: { id: ownerUserId },
    eduStatus,
  } = useLoaderData() as LoaderData;
  const { loggedInUser: user } = useRootRouteLoaderData();
  const {
    activeTeam: {
      userMakingRequest: { teamPermissions },
      team: { uuid: activeTeamUuid },
    },
  } = useDashboardContext();

  const canEditTeam = teamPermissions.includes('TEAM_EDIT');
  const classNameIcons = `mx-1 text-muted-foreground`;

  return (
    <nav className={`flex h-full flex-col gap-4 overflow-auto`}>
      <div className="sticky top-0 z-10 flex flex-col bg-background px-4 pt-4">
        <TeamSwitcher appIsLoading={isLoading} />
      </div>
      <div className={`flex flex-col px-4`}>
        <Type
          as="h3"
          variant="overline"
          className={`mb-2 mt-1 flex items-baseline justify-between indent-2 text-muted-foreground`}
        >
          Team
        </Type>
        <div className="grid gap-0.5">
          <div className="relative">
            <SidebarNavLink to={ROUTES.TEAM(activeTeamUuid)} dropTarget={canEditTeam ? null : undefined}>
              <FileIcon className={classNameIcons} />
              Files
            </SidebarNavLink>
            {canEditTeam && <SidebarNavLinkCreateButton to={ROUTES.CREATE_FILE(activeTeamUuid)} />}
          </div>
          <SidebarNavLink to={ROUTES.TEAM_CONNECTIONS(activeTeamUuid)}>
            <ConnectionsIcon className={classNameIcons} />
            Connections
          </SidebarNavLink>
          <SidebarNavLink to={ROUTES.TEAM_MEMBERS(activeTeamUuid)}>
            <PersonIcon className={classNameIcons} />
            Members
          </SidebarNavLink>
          {canEditTeam && (
            <SidebarNavLink to={ROUTES.TEAM_SETTINGS(activeTeamUuid)}>
              <GearIcon className={classNameIcons} />
              Settings
            </SidebarNavLink>
          )}
        </div>

        <Type
          as="h3"
          variant="overline"
          className={`mb-2 mt-6 flex items-baseline justify-between indent-2 text-muted-foreground`}
        >
          Private
        </Type>
        {canEditTeam && (
          <div className="relative">
            <SidebarNavLink to={ROUTES.TEAM_FILES_PRIVATE(activeTeamUuid)} dropTarget={ownerUserId}>
              <FileIcon className={classNameIcons} />
              Files
            </SidebarNavLink>
            <SidebarNavLinkCreateButton to={ROUTES.CREATE_FILE_PRIVATE(activeTeamUuid)} />
          </div>
        )}
        <SidebarNavLink to={ROUTES.FILES_SHARED_WITH_ME}>
          <Share2Icon className={classNameIcons} />
          Shared with me
        </SidebarNavLink>

        <Type
          as="h3"
          className={`${TYPE.overline} mb-2 mt-6 flex items-baseline justify-between indent-2 text-muted-foreground`}
        >
          Resources
        </Type>
        <div className="grid gap-0.5">
          <SidebarNavLink to={ROUTES.EXAMPLES}>
            <MixIcon className={classNameIcons} />
            Examples
          </SidebarNavLink>
          <SidebarNavLink
            to={DOCUMENTATION_URL}
            target="_blank"
            className="group text-muted-foreground hover:text-foreground"
          >
            <ExternalLinkIcon className={cn(classNameIcons, 'opacity-70 group-hover:text-foreground')} />
            Docs
          </SidebarNavLink>
          <SidebarNavLink
            to={CONTACT_URL}
            target="_blank"
            className="group text-muted-foreground hover:text-foreground"
          >
            <ExternalLinkIcon className={cn(classNameIcons, 'opacity-70 group-hover:text-foreground')} />
            Contact us
          </SidebarNavLink>
        </div>
      </div>
      <div className="mt-auto flex flex-col gap-1 bg-background px-4 pb-2">
        {eduStatus === 'ENROLLED' && (
          <SidebarNavLink
            to={`./?${SEARCH_PARAMS.DIALOG.KEY}=${SEARCH_PARAMS.DIALOG.VALUES.EDUCATION}`}
            onClick={(e) => {
              e.preventDefault();
              setSearchParams(
                (prev) => {
                  prev.set(SEARCH_PARAMS.DIALOG.KEY, SEARCH_PARAMS.DIALOG.VALUES.EDUCATION);
                  return prev;
                },
                { replace: true }
              );
            }}
          >
            <SchoolOutlined sx={{ fontSize: '16px' }} className={classNameIcons} />
            Education
            <Badge variant="secondary" className="ml-auto">
              Enrolled
            </Badge>
          </SidebarNavLink>
        )}
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

function SidebarNavLinkCreateButton({ to }: { to: string }) {
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button variant="ghost" size="icon-sm" asChild>
            <Link to={to} className="absolute right-2 top-1 ml-auto opacity-30 hover:opacity-100">
              <PlusIcon />
            </Link>
          </Button>
        </TooltipTrigger>
        <TooltipContent>Create new</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

function SidebarNavLink({
  to,
  children,
  className,
  dropTarget,
  isLogo,
  onClick,
  target,
}: {
  to: string;
  children: ReactNode;
  className?: string;
  // number = assigning to a user, null = assigning to a team
  dropTarget?: number | null;
  isLogo?: boolean;
  onClick?: (event: React.MouseEvent<HTMLAnchorElement, MouseEvent>) => void;
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

  const isDroppable = dropTarget !== undefined && to !== location.pathname;
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
          const data = getActionFileMove(dropTarget);
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

  const classes = cn(
    isActive && !isLogo && 'bg-muted',
    !isLogo && 'hover:bg-accent',
    isDraggingOver && 'bg-primary text-primary-foreground',
    TYPE.body2,
    `relative flex items-center gap-2 p-2 no-underline rounded`,
    className
  );

  return (
    <NavLink
      to={to}
      className={classes}
      {...(onClick ? { onClick } : {})}
      {...(target ? { target } : {})}
      {...dropProps}
    >
      {children}
    </NavLink>
  );
}
