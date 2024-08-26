import { useCheckForAuthorizationTokenOnWindowFocus } from '@/auth/auth';
import { DashboardSidebar } from '@/dashboard/components/DashboardSidebar';
import { EducationDialog } from '@/dashboard/components/EducationDialog';
import { Empty } from '@/dashboard/components/Empty';
import { useRootRouteLoaderData } from '@/routes/_root';
import { apiClient } from '@/shared/api/apiClient';
import { ROUTES, ROUTE_LOADER_IDS, SEARCH_PARAMS } from '@/shared/constants/routes';
import { CONTACT_URL, SCHEDULE_MEETING } from '@/shared/constants/urls';
import { useTheme } from '@/shared/hooks/useTheme';
import { Button } from '@/shared/shadcn/ui/button';
import { Sheet, SheetContent, SheetTrigger } from '@/shared/shadcn/ui/sheet';
import { cn } from '@/shared/shadcn/utils';
import { LiveChatWidget } from '@livechat/widget-react';
import { ExclamationTriangleIcon, HamburgerMenuIcon, InfoCircledIcon } from '@radix-ui/react-icons';
import * as Sentry from '@sentry/react';
import { ApiTypes } from 'quadratic-shared/typesAndSchemas';
import { createContext, useContext, useEffect, useRef, useState } from 'react';
import {
  Link,
  LoaderFunctionArgs,
  Outlet,
  ShouldRevalidateFunctionArgs,
  isRouteErrorResponse,
  redirect,
  redirectDocument,
  useLocation,
  useNavigation,
  useRevalidator,
  useRouteError,
  useRouteLoaderData,
  useSearchParams,
} from 'react-router-dom';

const DRAWER_WIDTH = 264;
export const ACTIVE_TEAM_UUID_KEY = 'activeTeamUuid';

/**
 * Dashboard state & context
 */
type DashboardState = {};
const initialDashboardState: DashboardState = {};
const DashboardContext = createContext(initialDashboardState);
export const useDashboardContext = () => useContext(DashboardContext);

/**
 * Revalidation
 */
export const shouldRevalidate = ({ currentUrl, nextUrl }: ShouldRevalidateFunctionArgs) => {
  // Re-validate if we're going to a teams route, otherwise skip
  return nextUrl.pathname.startsWith('/teams/');
};

/**
 * Loader
 */
type LoaderData = {
  teams: ApiTypes['/v0/teams.GET.response']['teams'];
  userMakingRequest: ApiTypes['/v0/teams.GET.response']['userMakingRequest'];
  eduStatus: ApiTypes['/v0/education.GET.response']['eduStatus'];
  initialActiveTeamUuid: string;
  activeTeam: ApiTypes['/v0/teams/:uuid.GET.response'];
};

export const loader = async ({ params, request }: LoaderFunctionArgs): Promise<LoaderData | Response> => {
  /**
   * Get the initial data
   */
  const [{ teams, userMakingRequest }, { eduStatus }] = await Promise.all([
    apiClient.teams.list(),
    apiClient.education.get(),
  ]);

  /**
   * Determine what the active team is
   */
  let initialActiveTeamUuid = undefined;
  const uuidFromUrl = params.teamUuid;
  const uuidFromLocalStorage = localStorage.getItem(ACTIVE_TEAM_UUID_KEY);

  // 1) Check the URL for a team UUID
  // FYI: if you have a UUID in the URL or localstorage, it doesn’t mean you
  // have acces to it (maybe you were removed from a team, so it’s a 404)
  // So we have to ensure we A) have a UUID, and B) it's in the list of teams
  // we have access to from the server.
  if (uuidFromUrl) {
    initialActiveTeamUuid = uuidFromUrl;

    // 2) Check localstorage for a team UUID
    // If what's in localstorage is not in the list of teams — e.g. you lost
    // access to a team —  we'll skip this step
  } else if (uuidFromLocalStorage && teams.find((team) => team.team.uuid === uuidFromLocalStorage)) {
    initialActiveTeamUuid = uuidFromLocalStorage;

    // 3) there's no default preference (yet), so pick the 1st one in the API
  } else if (teams.length > 0) {
    initialActiveTeamUuid = teams[0].team.uuid;

    // 4) there's no teams in the API, so create one and send the user to it
  } else if (teams.length === 0) {
    const newTeam = await apiClient.teams.create({ name: 'My Team' });
    return redirectDocument(ROUTES.TEAM(newTeam.uuid));
  }

  // This should never happen, but if it does, we'll log it to sentry
  if (initialActiveTeamUuid === undefined) {
    Sentry.captureEvent({
      message: 'No active team was found or could be created.',
      level: 'fatal',
    });
    throw new Error('No active team could be found or created.');
  }

  // If this was a request to the root of the app, re-route to the active team
  const url = new URL(request.url);
  if (url.pathname === '/') {
    // If there are search params, keep 'em
    return redirect(ROUTES.TEAM(initialActiveTeamUuid) + url.search);
  }

  /**
   * Get data for the active team
   */
  const activeTeam = await apiClient.teams
    .get(initialActiveTeamUuid)
    .then((data) => {
      // If we got to here, we successfully loaded the active team so now this is
      // the one we keep in localstorage for when the page loads anew
      localStorage.setItem(ACTIVE_TEAM_UUID_KEY, initialActiveTeamUuid);

      // Sort the users so the logged-in user is first in the list
      data.users.sort((a, b) => {
        const loggedInUser = data.userMakingRequest.id;
        // Move the logged in user to the front
        if (a.id === loggedInUser && b.id !== loggedInUser) return -1;
        // Keep the logged in user at the front
        if (a.id !== loggedInUser && b.id === loggedInUser) return 1;
        // Leave the order as is for others
        return 0;
      });

      return data;
    })
    .catch((error) => {
      // If we errored out, remove this one from localstorage because we can't access it
      // so we don't want to keep trying to load it on the home route `/`
      localStorage.setItem(ACTIVE_TEAM_UUID_KEY, '');
      const { status } = error;
      if (status >= 400 && status < 500) throw new Response('4xx level error', { status });
      throw error;
    });

  return { teams, userMakingRequest, eduStatus, initialActiveTeamUuid, activeTeam };
};
export const useDashboardRouteLoaderData = () => useRouteLoaderData(ROUTE_LOADER_IDS.DASHBOARD) as LoaderData;

/**
 * Component
 */
export const Component = () => {
  const [searchParams] = useSearchParams();
  const navigation = useNavigation();
  const location = useLocation();
  const [isOpen, setIsOpen] = useState<boolean>(false);
  const contentPaneRef = useRef<HTMLDivElement>(null);
  const revalidator = useRevalidator();
  const { loggedInUser: user } = useRootRouteLoaderData();

  const isLoading = revalidator.state !== 'idle' || navigation.state !== 'idle';
  const navbar = <DashboardSidebar isLoading={isLoading} />;

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
    <DashboardContext.Provider value={{}}>
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

export const ErrorBoundary = () => {
  const error = useRouteError();

  const actions = (
    <div className="flex justify-center gap-1">
      <Button asChild variant="outline">
        <a href={CONTACT_URL} target="_blank" rel="noreferrer">
          Get help
        </a>
      </Button>
      <Button asChild>
        <Link to="/">Go home</Link>
      </Button>
    </div>
  );

  const actionsLicenseRevoked = (
    <div className="flex justify-center gap-1">
      <Button asChild variant="outline">
        <a href={CONTACT_URL} target="_blank" rel="noreferrer">
          Contact Support
        </a>
      </Button>
      <Button asChild>
        <a href={SCHEDULE_MEETING} target="_blank" rel="noreferrer">
          Schedule Meeting
        </a>
      </Button>
    </div>
  );

  if (isRouteErrorResponse(error)) {
    if (error.status === 402)
      return (
        <Empty
          title="License Revoked"
          description="Your license has been revoked. Please contact Quadratic Support."
          Icon={InfoCircledIcon}
          actions={actionsLicenseRevoked}
        />
      );
    if (error.status === 403)
      return (
        <Empty
          title="You don’t have access to this team"
          description="Reach out to the team owner for permission to access this team."
          Icon={InfoCircledIcon}
          actions={actions}
        />
      );
    if (error.status === 404 || error.status === 400)
      return (
        <Empty
          title="Team not found"
          description="This team may have been deleted, moved, or made unavailable. Try reaching out to the team owner."
          Icon={ExclamationTriangleIcon}
          actions={actions}
        />
      );
  }

  // Maybe we log this to Sentry someday...
  console.error(error);
  return (
    <Empty
      title="Unexpected error"
      description="Something went wrong loading this team. If the error continues, contact us."
      Icon={ExclamationTriangleIcon}
      actions={
        <Button asChild>
          <Link to="/">Go home</Link>
        </Button>
      }
      severity="error"
    />
  );
};
