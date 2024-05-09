import * as CloudFilesMigration from '@/dashboard/CloudFilesMigrationRoute';
import { BrowserCompatibilityLayoutRoute } from '@/dashboard/components/BrowserCompatibilityLayoutRoute';
import { Empty } from '@/dashboard/components/Empty';
import * as FileMeta from '@/routes/_file.$uuid';
import * as Create from '@/routes/files.create';
import { apiClient } from '@/shared/api/apiClient';
import { SUPPORT_EMAIL } from '@/shared/constants/appConstants';
import { ROUTES, ROUTE_LOADER_IDS, SEARCH_PARAMS } from '@/shared/constants/routes';
import { Button } from '@/shared/shadcn/ui/button';
import { ExclamationTriangleIcon } from '@radix-ui/react-icons';
import localforage from 'localforage';
import {
  Link,
  Navigate,
  Route,
  ShouldRevalidateFunctionArgs,
  createBrowserRouter,
  createRoutesFromElements,
  redirect,
  useLocation,
} from 'react-router-dom';
import { authClient, protectedRouteLoaderWrapper } from './auth';
import * as IndexRoute from './routes/index';

// @ts-expect-error - for testing purposes
window.lf = localforage;

const dontRevalidateDialogs = ({ currentUrl, nextUrl }: ShouldRevalidateFunctionArgs) => {
  const currentUrlSearchParams = new URLSearchParams(currentUrl.search);
  const nextUrlSearchParams = new URLSearchParams(nextUrl.search);

  if (nextUrlSearchParams.get(SEARCH_PARAMS.DIALOG.KEY) || currentUrlSearchParams.get(SEARCH_PARAMS.DIALOG.KEY)) {
    return false;
  }
  return true;
};

export const router = createBrowserRouter(
  createRoutesFromElements(
    <>
      <Route
        path="/"
        id={ROUTE_LOADER_IDS.ROOT}
        loader={IndexRoute.loader}
        Component={IndexRoute.Component}
        ErrorBoundary={IndexRoute.ErrorBoundary}
      >
        <Route path="file">
          {/* Check that the browser is supported _before_ we try to load anything from the API */}
          <Route element={<BrowserCompatibilityLayoutRoute />}>
            <Route index element={<Navigate to={ROUTES.FILES} replace />} />
            <Route
              path=":uuid"
              id={ROUTE_LOADER_IDS.FILE}
              lazy={() => import('./routes/file.$uuid')}
              shouldRevalidate={
                // We don't want to revalidate the initial file route because
                // we don't have any 2-way data flow setup for the file contents
                // But file metadata is handled in the pathless route below
                () => false
              }
            >
              {/* TODO: (connections) we need to figure out what to do here when it's a publicly viewable file */}
              <Route path="" id={ROUTE_LOADER_IDS.FILE_METADATA} loader={FileMeta.loader}>
                {/* TODO: (connections) consider popping a dialog right away, then loading the body for lazy loading */}
                <Route path="connections" lazy={() => import('./routes/file.$uuid.connections')}>
                  <Route
                    index
                    lazy={async () => {
                      const { Index } = await import('./routes/file.$uuid.connections');
                      return { Component: Index };
                    }}
                  />
                  <Route
                    path=":connectionUuid"
                    lazy={() => import('./routes/file.$uuid.connections.$connectionUuid')}
                  />
                  <Route
                    path="create/:connectionType"
                    lazy={() => import('./routes/file.$uuid.connections.create.$connectionType')}
                  />
                </Route>
              </Route>
            </Route>
          </Route>
        </Route>

        <Route loader={protectedRouteLoaderWrapper(async () => null)}>
          <Route
            index
            Component={() => {
              const { search } = useLocation();
              return <Navigate to={ROUTES.FILES + search} replace />;
            }}
          />
          <Route
            path={ROUTES.CREATE_FILE}
            loader={Create.loader}
            action={Create.action}
            shouldRevalidate={() => false}
          />
          <Route
            path={ROUTES.EDUCATION_ENROLL}
            loader={async () => {
              // Check their status, then send them to the dashboard with the education dialog
              await apiClient.education.refresh();
              return redirect(`${ROUTES.FILES}?${SEARCH_PARAMS.DIALOG.KEY}=${SEARCH_PARAMS.DIALOG.VALUES.EDUCATION}`);
            }}
          />

          <Route
            id={ROUTE_LOADER_IDS.DASHBOARD}
            lazy={() => import('./routes/_dashboard')}
            shouldRevalidate={dontRevalidateDialogs}
          >
            <Route path={ROUTES.FILES}>
              <Route index lazy={() => import('./routes/files')} shouldRevalidate={dontRevalidateDialogs} />

              {/* Resource routes */}
              <Route path=":uuid" lazy={() => import('./routes/files.$uuid')} />
              <Route path=":uuid/sharing" lazy={() => import('./routes/files.$uuid.sharing')} />
            </Route>
            <Route
              path={ROUTES.FILES_SHARED_WITH_ME}
              lazy={() => import('./routes/files.shared-with-me')}
              shouldRevalidate={dontRevalidateDialogs}
            />
            <Route
              path={ROUTES.EXAMPLES}
              lazy={() => import('./routes/examples')}
              shouldRevalidate={dontRevalidateDialogs}
            />
            <Route
              path={ROUTES.ACCOUNT}
              lazy={() => import('./routes/account')}
              shouldRevalidate={dontRevalidateDialogs}
            />

            <Route path={ROUTES.TEAMS}>
              <Route index element={<Navigate to={ROUTES.FILES} replace />} />
              <Route
                path=":uuid"
                id={ROUTE_LOADER_IDS.TEAM}
                lazy={() => import('./routes/teams.$uuid')}
                shouldRevalidate={dontRevalidateDialogs}
              />
            </Route>
          </Route>

          <Route // TODO: remove route
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
          const isAuthenticated = await authClient.isAuthenticated();

          // If they’re logged in, redirect home
          if (isAuthenticated) {
            return redirect('/');
          }

          // If not, send them to Auth0
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
              // Acknowledge the user has just logged in. The backend may need
              // to run some logic before making any other API calls in parallel
              await apiClient.users.acknowledge();

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
