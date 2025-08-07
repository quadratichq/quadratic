import { requireAuth, useCheckForAuthorizationTokenOnWindowFocus } from '@/auth/auth';
import { DashboardSidebar } from '@/dashboard/components/DashboardSidebar';
import { EducationDialog } from '@/dashboard/components/EducationDialog';
import { ImportProgressList } from '@/dashboard/components/ImportProgressList';
import { apiClient } from '@/shared/api/apiClient';
import { EmptyPage } from '@/shared/components/EmptyPage';
import { MenuIcon } from '@/shared/components/Icons';
import { ROUTE_LOADER_IDS, ROUTES, SEARCH_PARAMS } from '@/shared/constants/routes';
import { CONTACT_URL, SCHEDULE_MEETING } from '@/shared/constants/urls';
import { useRemoveInitialLoadingUI } from '@/shared/hooks/useRemoveInitialLoadingUI';
import { Button } from '@/shared/shadcn/ui/button';
import { Sheet, SheetContent, SheetTrigger } from '@/shared/shadcn/ui/sheet';
import { TooltipProvider } from '@/shared/shadcn/ui/tooltip';
import { cn } from '@/shared/shadcn/utils';
import { setActiveTeam } from '@/shared/utils/activeTeam';
import { registerEventAnalyticsData } from '@/shared/utils/analyticsEvents';
import { ExclamationTriangleIcon, InfoCircledIcon } from '@radix-ui/react-icons';
import type { ApiTypes } from 'quadratic-shared/typesAndSchemas';
import { useEffect, useRef, useState } from 'react';
import type { LoaderFunctionArgs, ShouldRevalidateFunctionArgs } from 'react-router';

import {
  isRouteErrorResponse,
  Link,
  Outlet,
  redirect,
  useLocation,
  useNavigation,
  useRevalidator,
  useRouteError,
  useRouteLoaderData,
  useSearchParams,
} from 'react-router';
import { RecoilRoot } from 'recoil';

export const DRAWER_WIDTH = 264;

/**
 * Revalidation
 */
export const shouldRevalidate = ({ currentUrl, nextUrl }: ShouldRevalidateFunctionArgs) => {
  return (
    currentUrl.pathname === '/' ||
    currentUrl.pathname.startsWith('/file/') ||
    nextUrl.pathname === '/' ||
    nextUrl.pathname.startsWith('/teams/')
  );
};

/**
 * Loader
 */
type LoaderData = {
  teams: ApiTypes['/v0/teams.GET.response']['teams'];
  userMakingRequest: ApiTypes['/v0/teams.GET.response']['userMakingRequest'];
  eduStatus: ApiTypes['/v0/education.GET.response']['eduStatus'];
  activeTeam: ApiTypes['/v0/teams/:uuid.GET.response'];
};

export const loader = async (loaderArgs: LoaderFunctionArgs): Promise<LoaderData | Response> => {
  const { activeTeamUuid } = await requireAuth();
  const { params, request } = loaderArgs;

  // Check the URL for a team UUID. If there's one, use that as it’s what the
  // user is explicitly looking at. Otherwise, fallback to the one in localstorage
  const teamUuid = params.teamUuid ? params.teamUuid : activeTeamUuid;

  // If this was a request to the root of the app, re-route to the active team
  const url = new URL(request.url);
  if (url.pathname === '/') {
    throw redirect(ROUTES.TEAM(teamUuid) + url.search);
  }

  /**
   * Get the initial data
   */
  const [{ teams, userMakingRequest }, { eduStatus }] = await Promise.all([
    apiClient.teams.list(),
    apiClient.education.get(),
  ]);

  /**
   * Get data for the active team
   */
  const activeTeam = await apiClient.teams
    .get(teamUuid)
    .then((data) => {
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

      // We accessed the team successfully, so set it as the active team
      setActiveTeam(teamUuid);

      return data;
    })
    .catch((error) => {
      // If we errored out, remove this one from localstorage because we can't access it
      // so we don't want to keep trying to load it on the home route `/`
      setActiveTeam('');
      const { status } = error;
      if (status >= 400 && status < 500) throw new Response('4xx level error', { status });
      throw error;
    });

  registerEventAnalyticsData({
    isOnPaidPlan: activeTeam.billing.status === 'ACTIVE',
  });

  return { teams, userMakingRequest, eduStatus, activeTeam };
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

  const isLoading = revalidator.state !== 'idle' || navigation.state !== 'idle';

  useRemoveInitialLoadingUI();

  // When the location changes, close the menu (if it's already open) and reset scroll
  useEffect(() => {
    setIsOpen((prevIsOpen) => (prevIsOpen ? false : prevIsOpen));
    if (contentPaneRef.current) contentPaneRef.current.scrollTop = 0;
  }, [location.pathname]);

  // Ensure long-running browser sessions still have a token
  useCheckForAuthorizationTokenOnWindowFocus();

  // Revalidate when arriving on this page after reload document followed by back button
  useEffect(() => {
    const handlePageShow = (e: PageTransitionEvent) => {
      revalidator.revalidate();
    };
    window.addEventListener('pageshow', handlePageShow);
    return () => {
      window.removeEventListener('pageshow', handlePageShow);
    };
  }, [revalidator]);

  return (
    <RecoilRoot>
      <TooltipProvider>
        <div className={`h-full lg:flex lg:flex-row`}>
          <div
            ref={contentPaneRef}
            className={cn(
              `relative order-2 flex h-full w-full flex-grow flex-col px-4 pb-10 transition-all sm:pt-0 lg:px-10`,
              isLoading ? 'overflow-hidden' : 'overflow-auto',
              isLoading && 'pointer-events-none opacity-25'
            )}
            style={{
              scrollbarGutter: 'stable',
            }}
          >
            <div className={`sticky top-0 z-50 -mx-4 flex items-center justify-end bg-background px-2 py-1 lg:hidden`}>
              <Sheet open={isOpen} onOpenChange={setIsOpen}>
                <SheetTrigger asChild>
                  <Button variant="ghost" size="icon" onClick={() => setIsOpen(true)}>
                    <MenuIcon />
                  </Button>
                </SheetTrigger>
                <SheetContent className="p-0" style={{ width: DRAWER_WIDTH }}>
                  <DashboardSidebar isLoading={isLoading} />
                </SheetContent>
              </Sheet>
            </div>
            <Outlet />
          </div>
          <div
            className={`order-1 hidden flex-shrink-0 border-r border-r-border lg:block`}
            style={{ width: DRAWER_WIDTH }}
          >
            <DashboardSidebar isLoading={isLoading} />
          </div>
          {searchParams.get(SEARCH_PARAMS.DIALOG.KEY) === SEARCH_PARAMS.DIALOG.VALUES.EDUCATION && <EducationDialog />}
        </div>
        <ImportProgressList />
      </TooltipProvider>
    </RecoilRoot>
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
        <EmptyPage
          title="License Revoked"
          description="Your license has been revoked. Please contact Quadratic Support."
          Icon={InfoCircledIcon}
          actions={actionsLicenseRevoked}
        />
      );
    if (error.status === 403)
      return (
        <EmptyPage
          title="You don’t have access to this team"
          description="Reach out to the team owner for permission to access this team."
          Icon={InfoCircledIcon}
          actions={actions}
        />
      );
    if (error.status === 404 || error.status === 400)
      return (
        <EmptyPage
          title="Team not found"
          description="This team may have been deleted, moved, or made unavailable. Try reaching out to the team owner."
          Icon={ExclamationTriangleIcon}
          actions={actions}
        />
      );
  }

  console.error(error);
  return (
    <EmptyPage
      title="Unexpected error"
      description="Something went wrong loading this team. If the error continues, contact us."
      Icon={ExclamationTriangleIcon}
      actions={
        <Button asChild>
          <Link to="/">Go home</Link>
        </Button>
      }
      error={error}
    />
  );
};
