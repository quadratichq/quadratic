import { authClient } from '@/auth';
import * as CloudFilesMigration from '@/dashboard/CloudFilesMigrationRoute';
import { Empty } from '@/dashboard/components/Empty';
import { GlobalSnackbarProvider } from '@/shared/components/GlobalSnackbarProvider';
import { Theme } from '@/shared/components/Theme';
import { ROUTE_LOADER_IDS } from '@/shared/constants/routes';
import { initializeAnalytics } from '@/shared/utils/analytics';
import { User } from '@auth0/auth0-spa-js';
import { ExclamationTriangleIcon } from '@radix-ui/react-icons';
import * as Sentry from '@sentry/react';
import { LoaderFunctionArgs, Outlet, redirect, useRouteError, useRouteLoaderData } from 'react-router-dom';

export type RootLoaderData = {
  isAuthenticated: boolean;
  loggedInUser?: User;
};

export const useRootRouteLoaderData = () => useRouteLoaderData(ROUTE_LOADER_IDS.ROOT) as RootLoaderData;

export const loader = async ({ request, params }: LoaderFunctionArgs): Promise<RootLoaderData | Response> => {
  // All other routes get the same data
  const isAuthenticated = await authClient.isAuthenticated();
  const user = await authClient.user();

  // This is where we determine whether we need to run a migration
  // This redirect should trigger for every route _except_ the migration
  // route (this prevents an infinite loop of redirects).
  const url = new URL(request.url);
  if (isAuthenticated && !url.pathname.startsWith('/cloud-migration')) {
    if (await CloudFilesMigration.needsMigration()) {
      return redirect('/cloud-migration');
    }
  }

  initializeAnalytics(user);

  return { isAuthenticated, loggedInUser: user };
};

export const Component = () => {
  return (
    <Theme>
      <GlobalSnackbarProvider>
        <Outlet />
      </GlobalSnackbarProvider>
    </Theme>
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
    />
  );
};
