import { User } from '@auth0/auth0-spa-js';
import { ErrorOutline, WarningAmber } from '@mui/icons-material';
import { Button } from '@mui/material';
import * as Sentry from '@sentry/react';
import localforage from 'localforage';
import {
  Link,
  Navigate,
  Outlet,
  Route,
  createBrowserRouter,
  createRoutesFromElements,
  redirect,
  useRouteError,
  useRouteLoaderData,
} from 'react-router-dom';
import { authClient, protectedRouteLoaderWrapper } from './auth';
import { Empty } from './components/Empty';
import { GlobalSnackbarProvider } from './components/GlobalSnackbar';
import { Theme } from './components/Theme';
import { ROUTES } from './constants/routes';
import * as CloudFilesMigration from './dashboard/CloudFilesMigrationRoute';
import { BrowserCompatibilityLayoutRoute } from './dashboard/components/BrowserCompatibilityLayoutRoute';
import * as Create from './dashboard/files/CreateRoute';
import { debugLogAuth } from './debugFlags';
import { initializeAnalytics } from './utils/analytics';
// @ts-expect-error - for testing purposes
window.lf = localforage;

export type RootLoaderData = {
  isAuthenticated: boolean;
  user?: User;
};

export const useRootRouteLoaderData = () => useRouteLoaderData('root') as RootLoaderData;

export const router = createBrowserRouter(
  createRoutesFromElements(
    <>
      <Route
        path="/"
        loader={protectedRouteLoaderWrapper(async ({ request, params }): Promise<RootLoaderData | Response> => {
          // This is where we determine whether we need to run a migration
          // This redirect should trigger for every route _except_ the migration
          // route (this prevents an infinite loop of redirects).
          const url = new URL(request.url);
          if (!url.pathname.startsWith('/cloud-migration')) {
            if (await CloudFilesMigration.needsMigration()) {
              return redirect('/cloud-migration');
            }
          }

          // All other routes get the same data
          let isAuthenticated = await authClient.isAuthenticated();
          let user = await authClient.user();
          if (debugLogAuth) console.log('[auth] / <loader>: isAuthenticated: %s', isAuthenticated);
          initializeAnalytics({ isAuthenticated, user });

          return { isAuthenticated, user };
        })}
        element={<Root />}
        errorElement={<RootError />}
        id="root"
      >
        <Route index element={<Navigate to={ROUTES.FILES} replace />} />

        <Route path="file">
          {/* Check that the browser is supported _before_ we try to load anything from the API */}
          <Route element={<BrowserCompatibilityLayoutRoute />}>
            <Route index element={<Navigate to={ROUTES.FILES} replace />} />
            <Route path=":uuid" lazy={() => import('./dashboard/FileRoute')} />
          </Route>
        </Route>

        <Route path={ROUTES.CREATE_FILE} loader={Create.loader} action={Create.action} shouldRevalidate={() => false} />

        <Route lazy={() => import('./dashboard/components/DashboardLayoutRoute')}>
          <Route path={ROUTES.FILES} element={<Navigate to={ROUTES.MY_FILES} replace />} />
          <Route path={ROUTES.MY_FILES} lazy={() => import('./dashboard/files/MineRoute')} />
          <Route path={ROUTES.EXAMPLES} lazy={() => import('./dashboard/files/ExamplesRoute')} />
          <Route path={ROUTES.TEAMS} lazy={() => import('./dashboard/TeamsRoute')} />
          <Route path={ROUTES.ACCOUNT} lazy={() => import('./dashboard/AccountRoute')} />
        </Route>

        <Route
          path="/cloud-migration"
          element={<CloudFilesMigration.Component />}
          loader={CloudFilesMigration.loader}
        />

        <Route
          path="*"
          element={
            <Empty
              title="404: not found"
              description="What you’re looking for could not be found. Check the URL and try again."
              Icon={WarningAmber}
              actions={
                <Button component={Link} to="/" variant="contained" disableElevation>
                  Go home
                </Button>
              }
            />
          }
        />
      </Route>
      <Route
        path={ROUTES.LOGIN}
        loader={async ({ request }) => {
          let isAuthenticated = await authClient.isAuthenticated();

          // If they’re authenticated, redirect home
          if (isAuthenticated) {
            if (debugLogAuth) console.log('[auth] redirect to home after login');
            return redirect('/');
          }

          // If they’re not authenticated, send them to Auth0
          // Watch for a `from` query param, as unprotected routes will redirect
          // to here for them to auth first
          if (debugLogAuth) console.log('[auth] send to auth0 for login');
          const url = new URL(request.url);
          const redirectTo = url.searchParams.get('from') || '';
          await authClient.login(redirectTo);

          return null;
        }}
      />
      <Route
        path={ROUTES.LOGIN_RESULT}
        loader={async () => {
          // try/catch here handles case where this _could_ error out and we
          // have no errorElement so we just redirect back to home
          try {
            await authClient.handleSigninRedirect();
            let isAuthenticated = await authClient.isAuthenticated();
            if (isAuthenticated) {
              let redirectTo = new URLSearchParams(window.location.search).get('redirectTo') || '/';
              return redirect(redirectTo);
            }
          } catch (e) {
            console.error(e);
          }
          return redirect('/');
        }}
      />
      <Route
        path={ROUTES.LOGOUT}
        loader={async () => {
          return redirect('/');
        }}
        action={async () => {
          // We signout in a "resource route" that we can hit from a fetcher.Form
          await authClient.logout();
          return redirect('/');
        }}
      />
    </>
  )
);

function Root() {
  return (
    <Theme>
      <GlobalSnackbarProvider>
        <Outlet />
      </GlobalSnackbarProvider>
    </Theme>
  );
}

function RootError() {
  let error = useRouteError();
  console.error(error);

  Sentry.captureException({
    message: `RootRoute error element triggered. ${error}`,
  });

  return (
    <Empty
      title="Something went wrong"
      description="An unexpected error occurred. Try reloading the page or contact us if the error continues."
      Icon={ErrorOutline}
    />
  );
}
