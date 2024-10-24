import { User, authClient } from '@/auth/auth';
import { Empty } from '@/dashboard/components/Empty';
import { GlobalSnackbarProvider } from '@/shared/components/GlobalSnackbarProvider';
import { Theme } from '@/shared/components/Theme';
import { ROUTE_LOADER_IDS } from '@/shared/constants/routes';
import { initializeAnalytics } from '@/shared/utils/analytics';
import { ExclamationTriangleIcon } from '@radix-ui/react-icons';
import * as Sentry from '@sentry/react';
import { LoaderFunctionArgs, Outlet, useRouteError, useRouteLoaderData } from 'react-router-dom';

export type RootLoaderData = {
  isAuthenticated: boolean;
  loggedInUser?: User;
};

export const useRootRouteLoaderData = () => useRouteLoaderData(ROUTE_LOADER_IDS.ROOT) as RootLoaderData;

export const loader = async ({ request, params }: LoaderFunctionArgs): Promise<RootLoaderData | Response> => {
  // All other routes get the same data
  const isAuthenticated = await authClient.isAuthenticated();
  const user = await authClient.user();

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
