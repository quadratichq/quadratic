import type { User } from '@/auth/auth';
import { authClient } from '@/auth/auth';
import { ConfirmProvider } from '@/shared/components/ConfirmProvider';
import { EmptyPage } from '@/shared/components/EmptyPage';
import { GlobalSnackbarProvider } from '@/shared/components/GlobalSnackbarProvider';
import { MuiTheme } from '@/shared/components/MuiTheme';
import { ROUTE_LOADER_IDS } from '@/shared/constants/routes';
import { ThemeAccentColorEffects } from '@/shared/hooks/useThemeAccentColor';
import { ThemeAppearanceModeEffects } from '@/shared/hooks/useThemeAppearanceMode';
import { initializeAnalytics } from '@/shared/utils/analytics';
import { ExclamationTriangleIcon } from '@radix-ui/react-icons';
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
        <ConfirmProvider>
          <>
            <Outlet />
            <ThemeAppearanceModeEffects />
            <ThemeAccentColorEffects />
          </>
        </ConfirmProvider>
      </GlobalSnackbarProvider>
    </MuiTheme>
  );
};

export const ErrorBoundary = () => {
  const error = useRouteError();

  return (
    <EmptyPage
      title="Something went wrong"
      description="An unexpected error occurred. Try reloading the page or contact us if the error continues."
      Icon={ExclamationTriangleIcon}
      error={error}
    />
  );
};
