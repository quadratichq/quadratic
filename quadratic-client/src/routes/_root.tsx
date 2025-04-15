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
import { useEffect, useState } from 'react';
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
 * The way this works is this component re-renders what's in the root
 * index.html file (re-using the same styles) so it never looks like a flash of
 * unstyled content as the app loads, but the additional logo gif animates in
 * for slower connections. But it keeps the same structure and markup as
 * the root index.html file so the layout doesn't jump.
 */
const STILL_LOADING_MS = 15000;
export const HydrateFallback = () => {
  const [isTakingALongTime, setIsTakingALongTime] = useState(false);

  useEffect(() => {
    const startTimeMs = Date.now();

    const timer = setTimeout(() => {
      setIsTakingALongTime(true);
      mixpanel.track('[Loading].still-loading', { timeMs: STILL_LOADING_MS });
    }, STILL_LOADING_MS);

    return () => {
      clearTimeout(timer);
      const loadTimeMs = Date.now() - startTimeMs;
      const route = window.location.pathname + window.location.search;
      mixpanel.track('[App].loading', {
        route,
        loadTimeMs,
      });
    };
  }, []);

  return (
    <div className="root-loader" id="root-loading-indicator">
      <div>
        <img src="/images/logo_etching.png" alt="Quadratic logo etching" />
        <img src="/images/logo_loading.gif" alt="Quadratic logo animation" className="absolute left-0 top-0" />
        <div
          className={
            'absolute left-1/2 top-full mt-4 w-96 -translate-x-1/2 opacity-0 transition-opacity duration-700 ease-in-out ' +
            (isTakingALongTime ? 'opacity-100' : '')
          }
        >
          <div className="text-center text-sm text-muted-foreground">Still loading…</div>
        </div>
      </div>
    </div>
  );
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
