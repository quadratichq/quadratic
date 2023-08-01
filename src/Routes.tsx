import { User } from '@auth0/auth0-spa-js';
import { ErrorOutline, WarningAmber } from '@mui/icons-material';
import {
  Navigate,
  Outlet,
  Route,
  RouterProvider,
  createBrowserRouter,
  createRoutesFromElements,
  redirect,
  useRouteError,
} from 'react-router-dom';
import { authClient } from './auth';
import Empty from './dashboard/Empty';
import { debugLogAuth } from './debugFlags';
import BrowserCompatibility from './quadratic/BrowserCompatibility';
import { Scripts } from './quadratic/Scripts';
import { Theme } from './quadratic/Theme';
import { QuadraticLoading } from './ui/loading/QuadraticLoading';

export type RootLoaderData = {
  isAuthenticated: boolean;
  user?: User;
};

const router = createBrowserRouter(
  createRoutesFromElements(
    <>
      <Route
        path="/"
        loader={async (): Promise<RootLoaderData> => {
          let isAuthenticated = await authClient.isAuthenticated();
          let user = await authClient.user();
          if (debugLogAuth) console.log('[auth] / <loader>: isAuthenticated: %s', isAuthenticated);
          return { isAuthenticated, user };
        }}
        element={<Root />}
        errorElement={<RootError />}
        id="root"
      >
        <Route index element={<Navigate to="/files" replace />} />
        <Route path="file">
          {/* Check that the browser is supported _before_ we try to load anything from the API */}
          <Route element={<BrowserCompatibility />}>
            <Route index element={<Navigate to="/files" replace />} />
            <Route path=":uuid" lazy={() => import('./App')} />
          </Route>
        </Route>

        <Route lazy={() => import('./dashboard/Layout')}>
          <Route path="files" element={<Navigate to="/files/mine" replace />} />
          <Route path="files/mine" lazy={() => import('./dashboard/routes/files/mine')} />
          <Route path="files/examples" lazy={() => import('./dashboard/routes/files/examples')} />
          <Route path="files/teams" lazy={() => import('./dashboard/routes/teams')} />
          <Route path="account" lazy={() => import('./dashboard/routes/account')} />
        </Route>

        <Route
          path="*"
          element={
            <Empty
              title="404: resource not found"
              description="What you’re looking for could not be found. Check the URL and try again."
              Icon={WarningAmber}
            />
          }
        />
      </Route>
      <Route
        path="/login"
        loader={async ({ request }) => {
          let isAuthenticated = await authClient.isAuthenticated();
          if (debugLogAuth) console.log('[auth] /login <loader>: isAuthenticated: %s', isAuthenticated);

          // If they’re authenticated, redirect home
          if (isAuthenticated) {
            if (debugLogAuth) console.log('[auth] /login redirect to home');
            return redirect('/');
          }

          // If they’re not authenticated, send them to Auth0
          // Watch for a `from` query param, as unprotected routes will redirect
          // to here for them to auth first
          if (debugLogAuth) console.log('[auth] /login send to auth0');
          const url = new URL(request.url);
          const redirectTo = url.searchParams.get('from') || '';
          await authClient.login(redirectTo);

          return null;
        }}
      />
      <Route
        path="/login-result"
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
        path="/logout"
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
        <Outlet />
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
