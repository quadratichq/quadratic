import * as Page404 from '@/routes/404';
import * as RootRoute from '@/routes/_root';
import * as File from '@/routes/file';
import * as Login from '@/routes/login';
import * as LoginResult from '@/routes/login-result';
import * as Logout from '@/routes/logout';
import { ROUTES, ROUTE_LOADER_IDS, SEARCH_PARAMS } from '@/shared/constants/routes';
import type { ShouldRevalidateFunctionArgs } from 'react-router';
import { Navigate, Route, createBrowserRouter, createRoutesFromElements } from 'react-router';

export const router = createBrowserRouter(
  createRoutesFromElements(
    <>
      <Route
        id={ROUTE_LOADER_IDS.ROOT}
        loader={RootRoute.loader}
        Component={RootRoute.Component}
        ErrorBoundary={RootRoute.ErrorBoundary}
        HydrateFallback={EmptyComponent}
      >
        {/**
         * ----------------------------------------------------------------
         * Public routes (auth optional)
         * ----------------------------------------------------------------
         */}

        {/**
         * --- App (spreadsheet)
         * Note: `/file` checks that the browser is supported _before_
         * anything else matches (and we try to load data from the API)
         */}
        <Route path="file" Component={File.Component}>
          <Route index element={<Navigate to="/" replace />} />
          <Route path=":uuid" lazy={() => import('./routes/file.$uuid')} id={ROUTE_LOADER_IDS.FILE} />
        </Route>

        {/**
         * ----------------------------------------------------------------
         * Protected routes (auth required)
         * Note: each lazy route needs to be protected with `requireUser()`
         * in its respective loader.
         * ----------------------------------------------------------------
         */}

        {/**
         * --- Client-side API routes
         * These are used internally by fetchers. They have no UI.
         * They don’t really need to be protected as you have to know them to
         * hit them, and they'll return 4xx errors if you do.
         */}
        <Route path="api">
          <Route path="files/:uuid" lazy={() => import('./routes/api.files.$uuid')} />
          <Route path="files/:uuid/sharing" lazy={() => import('./routes/api.files.$uuid.sharing')} />
          <Route path="connections" lazy={() => import('./routes/api.connections')} />
          <Route
            path="teams/:teamUuid/connections/:uuid/schema/:type"
            lazy={() => import('./routes/api.teams.$teamUuid.connections.$uuid.schema.$type')}
          />
        </Route>

        {/**
         * --- User URL routes
         * These are user-accessible via the URL bar, but have no UI.
         * Putting these outside the dashboard route `/` lets you hit them directly
         * without having to run the dashboard loader (which these don't need).
         */}
        <Route path="education/enroll" lazy={() => import('./routes/education.enroll')} />
        <Route path="files/create" lazy={() => import('./routes/files.create')} />
        <Route path="teams/:teamUuid/files/create" lazy={() => import('./routes/teams.$teamUuid.files.create')} />
        <Route path="team/*" lazy={() => import('./routes/team.$')} />

        {/**
         * --- UI routes
         * All the routes which render UI of some kind or another.
         */}
        <Route path="file/:uuid/history" lazy={() => import('./routes/file.$uuid.history')} />
        <Route path="file/:uuid/duplicate" lazy={() => import('./routes/file.$uuid.duplicate')} />
        <Route path="/" id={ROUTE_LOADER_IDS.DASHBOARD} lazy={() => import('./routes/_dashboard')}>
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
          <Route path={ROUTES.LABS} lazy={() => import('./routes/labs')} />

          <Route path="teams">
            <Route index element={<Navigate to="/" replace />} />
            <Route path="create" lazy={() => import('./routes/teams.create')} />
            <Route path=":teamUuid" lazy={() => import('./routes/teams.$teamUuid')}>
              <Route index lazy={() => import('./routes/teams.$teamUuid.index')} />
              <Route path="files/private" lazy={() => import('./routes/teams.$teamUuid.files.private')} />
              <Route path="members" lazy={() => import('./routes/teams.$teamUuid.members')} />
              <Route path="settings" lazy={() => import('./routes/teams.$teamUuid.settings')} />
              <Route path="connections" lazy={() => import('./routes/teams.$teamUuid.connections')} />
            </Route>
          </Route>
        </Route>
        <Route path="*" Component={Page404.Component} />
      </Route>
      <Route path={ROUTES.LOGIN} loader={Login.loader} Component={EmptyComponent} HydrateFallback={EmptyComponent} />
      <Route
        path={ROUTES.LOGIN_RESULT}
        loader={LoginResult.loader}
        Component={EmptyComponent}
        HydrateFallback={EmptyComponent}
      />
      <Route
        path={ROUTES.LOGOUT}
        loader={Logout.loader}
        action={Logout.action}
        Component={EmptyComponent}
        HydrateFallback={EmptyComponent}
      />
    </>
  ),
  {}
);

function dontRevalidateDialogs({ currentUrl, nextUrl }: ShouldRevalidateFunctionArgs) {
  const currentUrlSearchParams = new URLSearchParams(currentUrl.search);
  const nextUrlSearchParams = new URLSearchParams(nextUrl.search);

  if (nextUrlSearchParams.get(SEARCH_PARAMS.DIALOG.KEY) || currentUrlSearchParams.get(SEARCH_PARAMS.DIALOG.KEY)) {
    return false;
  }
  return true;
}

// Because our `index.html` starts with a loading state, which we remove when
// the app loads, we're fine rendering an empty component in various places.
// This is an explicit way to say what's implicitly happening.
// Otherwise, if we don't include thise, we get a bunch of console.warn()
// messages like "No HydrateFallback provided" or
// "Matched leaf route at location ... does not have an element..." which
// blog up sentry.
function EmptyComponent() {
  return null;
}
