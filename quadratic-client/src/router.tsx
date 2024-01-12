import { Button } from '@/shadcn/ui/button';
import { User } from '@auth0/auth0-spa-js';
import { ExclamationTriangleIcon } from '@radix-ui/react-icons';
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
import { GlobalSnackbarProvider } from './components/GlobalSnackbarProvider';
import { Theme } from './components/Theme';
import { SUPPORT_EMAIL } from './constants/appConstants';
import { ROUTES, ROUTE_LOADER_IDS } from './constants/routes';
import * as CloudFilesMigration from './dashboard/CloudFilesMigrationRoute';
import * as Create from './dashboard/FilesCreateRoute';
import { BrowserCompatibilityLayoutRoute } from './dashboard/components/BrowserCompatibilityLayoutRoute';
import { initializeAnalytics } from './utils/analytics';
// @ts-expect-error - for testing purposes
window.lf = localforage;

export type RootLoaderData = {
  isAuthenticated: boolean;
  loggedInUser?: User;
};

export const useRootRouteLoaderData = () => useRouteLoaderData(ROUTE_LOADER_IDS.ROOT) as RootLoaderData;

export const router = createBrowserRouter(
  createRoutesFromElements(
    <>
      <Route
        path="/"
        loader={async ({ request, params }): Promise<RootLoaderData | Response> => {
          // All other routes get the same data
          let isAuthenticated = await authClient.isAuthenticated();
          let user = await authClient.user();

          // This is where we determine whether we need to run a migration
          // This redirect should trigger for every route _except_ the migration
          // route (this prevents an infinite loop of redirects).
          const url = new URL(request.url);
          if (isAuthenticated && !url.pathname.startsWith('/cloud-migration')) {
            if (await CloudFilesMigration.needsMigration()) {
              return redirect('/cloud-migration');
            }
          }

          initializeAnalytics({ isAuthenticated, user });

          return { isAuthenticated, loggedInUser: user };
        }}
        element={<Root />}
        errorElement={<RootError />}
        id="root"
      >
        <Route path="file">
          {/* Check that the browser is supported _before_ we try to load anything from the API */}
          <Route element={<BrowserCompatibilityLayoutRoute />}>
            <Route index element={<Navigate to={ROUTES.FILES} replace />} />
            <Route
              path=":uuid"
              id={ROUTE_LOADER_IDS.FILE}
              lazy={() => import('./dashboard/FileRoute')}
              shouldRevalidate={({ currentUrl }) => {
                // We don't want to revalidate anythin in the app
                // because we don't have any 2-way data flow setup for the app
                return false;
              }}
            />
          </Route>
        </Route>

        <Route loader={protectedRouteLoaderWrapper(async () => null)}>
          <Route index element={<Navigate to={ROUTES.FILES} replace />} />
          <Route
            path={ROUTES.CREATE_FILE}
            loader={Create.loader}
            action={Create.action}
            shouldRevalidate={() => false}
          />

          <Route lazy={() => import('./dashboard/components/DashboardLayoutRoute')}>
            <Route path={ROUTES.FILES}>
              <Route index lazy={() => import('./routes/files')} />

              {/* Resource routes */}
              <Route path=":uuid" lazy={() => import('./routes/files.$uuid')} />
              <Route path=":uuid/sharing" lazy={() => import('./routes/files.$uuid.sharing')} />
            </Route>
            <Route path={ROUTES.FILES_SHARED_WITH_ME} lazy={() => import('./routes/files.shared-with-me')} />
            <Route path={ROUTES.EXAMPLES} lazy={() => import('./dashboard/ExamplesRoute')} />
            <Route path={ROUTES.ACCOUNT} lazy={() => import('./dashboard/AccountRoute')} />

            <Route path={ROUTES.TEAMS}>
              <Route index element={<Navigate to={ROUTES.FILES} replace />} />
              <Route path={ROUTES.CREATE_TEAM} lazy={() => import('./routes/teams.create')} />
              <Route path=":uuid" lazy={() => import('./routes/teams.$uuid')} />
            </Route>
          </Route>

          <Route
            path="/cloud-migration"
            element={<CloudFilesMigration.Component />}
            loader={CloudFilesMigration.loader}
          />
        </Route>

        <Route
          path="*"
          element={
            <Empty
              title="404: not found"
              description={
                <>
                  Check the URL and try again. Or, contact us for help at <a href={SUPPORT_EMAIL}>{SUPPORT_EMAIL}</a>
                </>
              }
              Icon={ExclamationTriangleIcon}
              actions={
                <Button asChild variant="secondary">
                  <Link to="/">Go home</Link>
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
            return redirect('/');
          }

          // If they’re not authenticated, send them to Auth0
          // Watch for a `from` query param, as unprotected routes will redirect
          // to here for them to auth first
          // Also watch for the presence of a `signup` query param, which means
          // send the user to sign up flow, not login
          const url = new URL(request.url);
          const redirectTo = url.searchParams.get('from') || '/';
          const isSignupFlow = url.searchParams.get('signup') !== null;
          await authClient.login(redirectTo, isSignupFlow);

          // auth0 will re-route us (above) but telling react-router where we
          // are re-routing to makes sure that this doesn't end up in the history stack
          // but we have to add an artifical delay that's long enough for
          // the auth0 navigation to take place
          await new Promise((resolve) => setTimeout(resolve, 10000));
          return redirect(redirectTo);
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
      Icon={ExclamationTriangleIcon}
    />
  );
}
