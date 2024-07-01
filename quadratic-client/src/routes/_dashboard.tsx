import { useCheckForAuthorizationTokenOnWindowFocus } from '@/auth';
import { AvatarTeam } from '@/dashboard/components/AvatarTeam';
import { CreateTeamDialog } from '@/dashboard/components/CreateTeamDialog';
import { EducationDialog } from '@/dashboard/components/EducationDialog';
import { QuadraticLogoType } from '@/dashboard/components/QuadraticLogoType';
import { Action as FileAction } from '@/routes/files.$uuid';
import { useRootRouteLoaderData } from '@/routes/index';
import { TeamAction } from '@/routes/teams.$uuid';
import { apiClient } from '@/shared/api/apiClient';
import { Type } from '@/shared/components/Type';
import { TYPE } from '@/shared/constants/appConstants';
import { ROUTES, ROUTE_LOADER_IDS, SEARCH_PARAMS } from '@/shared/constants/routes';
import { DOCUMENTATION_URL } from '@/shared/constants/urls';
import useLocalStorage from '@/shared/hooks/useLocalStorage';
import { useTheme } from '@/shared/hooks/useTheme';
import { Avatar, AvatarFallback } from '@/shared/shadcn/ui/avatar';
import { Badge } from '@/shared/shadcn/ui/badge';
import { Button } from '@/shared/shadcn/ui/button';
import { Sheet, SheetContent, SheetTrigger } from '@/shared/shadcn/ui/sheet';
import { cn } from '@/shared/shadcn/utils';
import { LiveChatWidget } from '@livechat/widget-react';
import { SchoolOutlined } from '@mui/icons-material';
import { AvatarImage } from '@radix-ui/react-avatar';
import {
  Cross2Icon,
  ExternalLinkIcon,
  FileIcon,
  HamburgerMenuIcon,
  MagicWandIcon,
  MixIcon,
  PlusIcon,
  ReaderIcon,
  ReloadIcon,
  Share2Icon,
} from '@radix-ui/react-icons';
import { Dispatch, ReactNode, SetStateAction, createContext, useContext, useEffect, useRef, useState } from 'react';
import {
  NavLink,
  Outlet,
  useFetchers,
  useLoaderData,
  useLocation,
  useNavigation,
  useParams,
  useRevalidator,
  useRouteLoaderData,
  useSearchParams,
  useSubmit,
} from 'react-router-dom';
import QuadraticLogo from '../dashboard/components/quadratic-logo.svg';

const DRAWER_WIDTH = 264;

/**
 * Dashboard state & context
 */
type DashboardState = {};
const initialDashboardState: DashboardState = {};
const DashboardContext = createContext([initialDashboardState, () => {}] as [
  DashboardState,
  Dispatch<SetStateAction<DashboardState>>
]);
export const useDashboardContext = () => useContext(DashboardContext);

/**
 * Loader
 */
type LoaderData = Awaited<ReturnType<typeof loader>>;
export const loader = async () => {
  const [teamsData, { eduStatus }] = await Promise.all([apiClient.teams.list(), apiClient.education.get()]);
  return { ...teamsData, eduStatus };
};
export const useDashboardRouteLoaderData = () => useRouteLoaderData(ROUTE_LOADER_IDS.DASHBOARD) as LoaderData;

/**
 * Component
 */
export const Component = () => {
  const [searchParams] = useSearchParams();
  const [dashboardState, setDashboardState] = useState<DashboardState>(initialDashboardState);
  const navigation = useNavigation();
  const location = useLocation();
  const [isOpen, setIsOpen] = useState<boolean>(false);
  const contentPaneRef = useRef<HTMLDivElement>(null);
  const revalidator = useRevalidator();
  const { loggedInUser: user } = useRootRouteLoaderData();
  useTheme(); // Trigger the theme in the root of the app

  const isLoading = revalidator.state !== 'idle' || navigation.state !== 'idle';
  const navbar = <Navbar isLoading={isLoading} />;

  // When the location changes, close the menu (if it's already open) and reset scroll
  useEffect(() => {
    setIsOpen((prevIsOpen) => (prevIsOpen ? false : prevIsOpen));
    if (contentPaneRef.current) contentPaneRef.current.scrollTop = 0;
  }, [location.pathname]);

  // Ensure long-running browser sessions still have a token
  useCheckForAuthorizationTokenOnWindowFocus();

  return (
    <DashboardContext.Provider value={[dashboardState, setDashboardState]}>
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
        {searchParams.get(SEARCH_PARAMS.DIALOG.KEY) === SEARCH_PARAMS.DIALOG.VALUES.CREATE_TEAM && <CreateTeamDialog />}
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
    teams,
    userMakingRequest: { id: ownerUserId },
    eduStatus,
  } = useLoaderData() as LoaderData;
  const { loggedInUser: user } = useRootRouteLoaderData();
  const fetchers = useFetchers();
  const revalidator = useRevalidator();
  const params = useParams();
  const [hideFancyCreateTeamMsgUserPref, setHideFancyCreateTeamMsgUserPref] = useLocalStorage(
    'hideFancyCreateTeamMsg',
    false
  );

  const teamsFiltered = teams.filter((team) => team.team.activated || team.team.uuid === params.uuid);
  const classNameIcons = `mx-1 text-muted-foreground`;
  let showTeamsUpgradeMsg = teamsFiltered.length === 0;
  if (hideFancyCreateTeamMsgUserPref) showTeamsUpgradeMsg = false;

  return (
    <nav className={`flex h-full flex-col justify-between gap-4 overflow-auto px-4 pb-2 pt-4`}>
      <div className={`flex flex-col`}>
        <div className={`flex items-center lg:justify-between`}>
          <SidebarNavLink
            to="."
            onClick={(e) => {
              e.preventDefault();
              revalidator.revalidate();
            }}
            className={`w-full`}
            isLogo={true}
          >
            <div className={`flex w-5 items-center justify-center`}>
              <img src={QuadraticLogo} alt="Quadratic logo glyph" />
            </div>
            <QuadraticLogoType />

            <ReloadIcon
              className={`ml-auto mr-1 animate-spin text-primary transition-opacity ${isLoading ? '' : ' opacity-0'}`}
            />
          </SidebarNavLink>
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
            My files
          </SidebarNavLink>
          <SidebarNavLink to={ROUTES.FILES_SHARED_WITH_ME}>
            <Share2Icon className={classNameIcons} />
            Shared with me
          </SidebarNavLink>
        </div>

        <Type
          as="h3"
          className={`${TYPE.overline} mb-2 mt-6 flex items-baseline justify-between indent-2 text-muted-foreground`}
        >
          Teams
        </Type>
        <div className="grid gap-0.5">
          {teamsFiltered.map(({ team: { id: ownerTeamId, uuid, name }, userMakingRequest: { teamPermissions } }) => {
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
            }

            return (
              <SidebarNavLink
                key={uuid}
                to={ROUTES.TEAM(uuid)}
                dropTarget={teamPermissions.includes('TEAM_EDIT') ? { type: 'team', id: ownerTeamId } : undefined}
                className="truncate"
              >
                <AvatarTeam className={`-my-0.5 h-6 w-6`} />
                <span className="block truncate">{name}</span>
              </SidebarNavLink>
            );
          })}
          {showTeamsUpgradeMsg ? (
            <div className="relative mb-2 flex flex-col gap-2 rounded bg-accent p-3 text-xs">
              <Button
                size="icon-sm"
                variant="ghost"
                className="absolute right-1 top-1 text-muted-foreground hover:text-foreground"
                onClick={() => {
                  setHideFancyCreateTeamMsgUserPref(true);
                }}
              >
                <Cross2Icon />
              </Button>
              <div className="flex gap-3">
                <MagicWandIcon className="mt-1 text-primary" />
                <div className="">
                  <h3 className="font-semibold">Create a team</h3>
                  <p className="text-muted-foreground">Unlock collaboration in Quadratic.</p>
                </div>
              </div>
              <Button
                size="sm"
                className="w-full"
                onClick={() => {
                  setSearchParams(
                    (prev) => {
                      prev.set(SEARCH_PARAMS.DIALOG.KEY, SEARCH_PARAMS.DIALOG.VALUES.CREATE_TEAM);
                      return prev;
                    },
                    { replace: true }
                  );
                }}
              >
                Create team
              </Button>
            </div>
          ) : (
            <SidebarNavLink
              to={`./?${SEARCH_PARAMS.DIALOG.KEY}=${SEARCH_PARAMS.DIALOG.VALUES.CREATE_TEAM}`}
              onClick={(e) => {
                e.preventDefault();
                setSearchParams(
                  (prev) => {
                    prev.set(SEARCH_PARAMS.DIALOG.KEY, SEARCH_PARAMS.DIALOG.VALUES.CREATE_TEAM);
                    return prev;
                  },
                  { replace: true }
                );
              }}
            >
              <PlusIcon className={classNameIcons} />
              Create
            </SidebarNavLink>
          )}
        </div>
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
          <SidebarNavLink to={DOCUMENTATION_URL} target="_blank" className="group">
            <ReaderIcon className={classNameIcons} />
            Docs
            <ExternalLinkIcon
              className={cn(classNameIcons, `ml-auto text-muted-foreground opacity-50 group-hover:opacity-100`)}
            />
          </SidebarNavLink>
        </div>
      </div>
      <div className="flex flex-col gap-1">
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
  dropTarget?: {
    type: 'user' | 'team';
    id: number;
  };
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
