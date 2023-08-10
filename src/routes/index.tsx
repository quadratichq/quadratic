import { User } from '@auth0/auth0-spa-js';
import { ErrorOutline, WarningAmber } from '@mui/icons-material';
import { Button } from '@mui/material';
import { ROUTES } from 'constants/routes';
import localforage from 'localforage';
import {
  Link,
  Navigate,
  Outlet,
  Route,
  RouterProvider,
  createBrowserRouter,
  createRoutesFromElements,
  redirect,
  useRouteError,
} from 'react-router-dom';
import * as CloudFilesMigration from 'shared/CloudFilesMigration';
import { GlobalSnackbarProvider } from 'shared/GlobalSnackbar';
import { authClient, protectedRouteLoaderWrapper } from '../auth';
import { debugLogAuth } from '../debugFlags';
import * as Create from '../routes/files/create';
import Empty from '../shared/Empty';
import BrowserCompatibility from '../shared/root/BrowserCompatibility';
import Scripts from '../shared/root/Scripts';
import Theme from '../shared/root/Theme';
import { QuadraticLoading } from '../ui/loading/QuadraticLoading';
// @ts-expect-error - for testing purposes
window.lf = localforage;

export type RootLoaderData = {
  isAuthenticated: boolean;
  user?: User;
};

const router = createBrowserRouter(
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
          return { isAuthenticated, user };
        })}
        element={<Root />}
        errorElement={<RootError />}
        id="root"
      >
        <Route index element={<Navigate to="/files" replace />} />

        <Route path="file">
          {/* Check that the browser is supported _before_ we try to load anything from the API */}
          <Route element={<BrowserCompatibility />}>
            <Route index element={<Navigate to="/files" replace />} />
            <Route path=":uuid" lazy={() => import('./file')} />
          </Route>
        </Route>

        <Route
          path="files/create"
          id="create"
          loader={Create.loader}
          action={Create.action}
          shouldRevalidate={() => false}
        />

        <Route lazy={() => import('../shared/dashboard/Layout')}>
          <Route path="files" element={<Navigate to={ROUTES.MY_FILES} replace />} />
          <Route path={ROUTES.MY_FILES} lazy={() => import('./files/mine')} />
          <Route path={ROUTES.EXAMPLES} lazy={() => import('./files/examples')} />
          <Route path={ROUTES.TEAMS} lazy={() => import('./teams')} />
          <Route path={ROUTES.ACCOUNT} lazy={() => import('./account')} />
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
          await authClient.handleSigninRedirect();
          let isAuthenticated = await authClient.isAuthenticated();
          if (isAuthenticated) {
            let redirectTo = new URLSearchParams(window.location.search).get('redirectTo') || '/';
            return redirect(redirectTo);
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

export const Routes = () => <RouterProvider router={router} fallbackElement={<QuadraticLoading />} />;

function Root() {
  return (
    <Theme>
      <Scripts>
        <GlobalSnackbarProvider>
          <Outlet />
        </GlobalSnackbarProvider>
      </Scripts>
    </Theme>
  );
}

function RootError() {
  let error = useRouteError();
  console.error(error);
  // TODO sentry catch error
  return (
    <Empty
      title="Something went wrong"
      description="An unexpected error occurred. Try reloading the page or contact us if the error continues."
      Icon={ErrorOutline}
    />
  );
}
