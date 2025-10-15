import { isWorkOs, useWorkOs } from '@/auth/useWorkOs';
import { ConfirmProvider } from '@/shared/components/ConfirmProvider';
import { EmptyPage } from '@/shared/components/EmptyPage';
import { GlobalSnackbarProvider } from '@/shared/components/GlobalSnackbarProvider';
import { MuiTheme } from '@/shared/components/MuiTheme';
import { ROUTE_LOADER_IDS } from '@/shared/constants/routes';
import { ThemeAccentColorEffects } from '@/shared/hooks/useThemeAccentColor';
import { ThemeAppearanceModeEffects } from '@/shared/hooks/useThemeAppearanceMode';
import { ExclamationTriangleIcon } from '@radix-ui/react-icons';
import { AuthKitProvider } from '@workos-inc/authkit-react';
import { Outlet, useRouteError, useRouteLoaderData } from 'react-router';

export const useRootRouteLoaderData = () => useRouteLoaderData(ROUTE_LOADER_IDS.ROOT);

// helper to ensure that the vanilla workOs functions are populated before
// they're called
export const InitializeAuthKit = (): null => {
  useWorkOs();
  return null;
};

export const Component = () => {
  if (isWorkOs) {
    return (
      <AuthKitProvider
        clientId={import.meta.env.VITE_WORKOS_CLIENT_ID}
        apiHostname={import.meta.env.VITE_QUADRATIC_API_URL}
      >
        <InitializeAuthKit />
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
      </AuthKitProvider>
    );
  }
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
  console.error(error);

  return (
    <EmptyPage
      title="Something went wrong"
      description="An unexpected error occurred. Try reloading the page or contact us if the error continues."
      Icon={ExclamationTriangleIcon}
      error={error}
    />
  );
};
