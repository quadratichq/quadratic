import { protectedRouteLoaderWrapper } from '@/auth/auth';
import { BrowserCompatibilityLayoutRoute } from '@/dashboard/components/BrowserCompatibilityLayoutRoute';
import * as Page404 from '@/routes/404';
import * as RootRoute from '@/routes/_root';
import * as Login from '@/routes/login';
import * as LoginResult from '@/routes/login-result';
import * as Logout from '@/routes/logout';
import { apiClient } from '@/shared/api/apiClient';
import { ROUTES, ROUTE_LOADER_IDS, SEARCH_PARAMS } from '@/shared/constants/routes';
import type { ShouldRevalidateFunctionArgs } from 'react-router-dom';
import { Navigate, Route, createBrowserRouter, createRoutesFromElements, redirect } from 'react-router-dom';

export const router = createBrowserRouter(
  createRoutesFromElements(
    <>
      <Route
        path="/"
        id={ROUTE_LOADER_IDS.ROOT}
        loader={RootRoute.loader}
        Component={RootRoute.Component}
        ErrorBoundary={RootRoute.ErrorBoundary}
        HydrateFallback={RootRoute.HydrateFallback}
      >
        <Route path="file">
          {/* Check that the browser is supported _before_ we try to load anything from the API */}
          <Route element={<BrowserCompatibilityLayoutRoute />}>
            <Route index element={<Navigate to="/" replace />} />
            <Route
              path=":uuid"
              id={ROUTE_LOADER_IDS.FILE}
              lazy={() => import('./routes/file.$uuid')}
              shouldRevalidate={({ currentParams, nextParams }) => currentParams.uuid !== nextParams.uuid}
            />
          </Route>
        </Route>

        <Route loader={protectedRouteLoaderWrapper(async () => null)}>
          {/* Resource routes: these are accessible via the URL bar, but have no UI
              Putting these outside the nested tree lets you hit them directly without having to load other data */}
          <Route
            path="education/enroll"
            loader={async () => {
              // Check their status, then send them to the dashboard with the education dialog
              await apiClient.education.refresh();
              return redirect(`/?${SEARCH_PARAMS.DIALOG.KEY}=${SEARCH_PARAMS.DIALOG.VALUES.EDUCATION}`);
            }}
          />
          <Route
            path="teams/:teamUuid/files/create"
            lazy={() => import('./routes/teams.$teamUuid.files.create')}
            shouldRevalidate={() => false}
          />
          <Route path="teams" index loader={() => redirect('/')} />

          {/* API routes: these are used by fetchers but have no UI */}
          <Route path="api">
            <Route path="files/:uuid" lazy={() => import('./routes/api.files.$uuid')} />
            <Route path="files/:uuid/sharing" lazy={() => import('./routes/api.files.$uuid.sharing')} />
            <Route path="connections" lazy={() => import('./routes/api.connections')} />
            <Route
              path="connections/:uuid/schema/:type"
              lazy={() => import('./routes/api.connections.$uuid.schema.$type')}
            />
          </Route>

          {/* Route to redirect to a new file in the app */}
          <Route path="files/create" lazy={() => import('./routes/files.create')} />

          {/* Dashboard UI routes */}
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
            <Route
              path={ROUTES.ACCOUNT}
              lazy={() => import('./routes/account')}
              shouldRevalidate={dontRevalidateDialogs}
            />
            <Route path={ROUTES.LABS} lazy={() => import('./routes/labs')} />

            <Route path="teams">
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
      </Route>
      <Route path={ROUTES.LOGIN} loader={Login.loader} />
      <Route path={ROUTES.LOGIN_RESULT} loader={LoginResult.loader} />
      <Route path={ROUTES.LOGOUT} loader={Logout.loader} action={Logout.action} />
    </>
  ),
  {
    future: {
      v7_fetcherPersist: true,
      v7_relativeSplatPath: true,
      v7_normalizeFormMethod: true,
      v7_partialHydration: true,
      v7_skipActionErrorRevalidation: true,
    },
  }
);

function dontRevalidateDialogs({ currentUrl, nextUrl }: ShouldRevalidateFunctionArgs) {
  const currentUrlSearchParams = new URLSearchParams(currentUrl.search);
  const nextUrlSearchParams = new URLSearchParams(nextUrl.search);

  if (nextUrlSearchParams.get(SEARCH_PARAMS.DIALOG.KEY) || currentUrlSearchParams.get(SEARCH_PARAMS.DIALOG.KEY)) {
    return false;
  }
  return true;
}
