import type { User } from '@/auth/auth';
import { authClient } from '@/auth/auth';
import { Empty } from '@/shared/components/Empty';
import { GlobalSnackbarProvider } from '@/shared/components/GlobalSnackbarProvider';
import { MuiTheme } from '@/shared/components/MuiTheme';
import { ROUTE_LOADER_IDS } from '@/shared/constants/routes';
import { ThemeAccentColorEffects } from '@/shared/hooks/useThemeAccentColor';
import { ThemeAppearanceModeEffects } from '@/shared/hooks/useThemeAppearanceMode';
import { initializeAnalytics } from '@/shared/utils/analytics';
import { ExclamationTriangleIcon } from '@radix-ui/react-icons';
import * as Sentry from '@sentry/react';
import mixpanel from 'mixpanel-browser';
import { useEffect } from 'react';
import type { LoaderFunctionArgs } from 'react-router';
import { Outlet, useRouteError, useRouteLoaderData } from 'react-router';

export type RootLoaderData = {
  isAuthenticated: boolean;
  loggedInUser?: User;
};

export const useRootRouteLoaderData = () => useRouteLoaderData(ROUTE_LOADER_IDS.ROOT) as RootLoaderData;

export const loader = async ({ request, params }: LoaderFunctionArgs): Promise<RootLoaderData | Response> => {
  const [isAuthenticated, user] = await Promise.all([authClient.isAuthenticated(), authClient.user()]);
  initializeAnalytics(user);

  return { isAuthenticated, loggedInUser: user };
};

export const Component = () => {
  return (
    <MuiTheme>
      <GlobalSnackbarProvider>
        <>
          <Outlet />
          <ThemeAppearanceModeEffects />
          <ThemeAccentColorEffects />
        </>
      </GlobalSnackbarProvider>
    </MuiTheme>
  );
};

/**
 * We use this to track the time it takes to load the matching root route and
 * do the first render.
 */
export const HydrateFallback = () => {
  useEffect(() => {
    const startTimeMs = Date.now();
    return () => {
      const loadTimeMs = Date.now() - startTimeMs;
      const route = window.location.pathname + window.location.search;
      mixpanel.track('[Loading].complete', {
        route,
        loadTimeMs,
      });
    };
  }, []);

  return null;
};

export const ErrorBoundary = () => {
  let error = useRouteError();
  console.error(error);

  Sentry.captureException({
    message: `RootRoute error element triggered. ${error}`,
  });

  return (
    <Empty
      title="Something went wrong"
      description="An unexpected error occurred. Try reloading the page or contact us if the error continues."
      Icon={ExclamationTriangleIcon}
      severity="error"
      error={error}
    />
  );
};
