import { BrowserCompatibilityLayoutRoute } from '@/dashboard/components/BrowserCompatibilityLayoutRoute';
import * as Page404 from '@/routes/404';
import * as FileMeta from '@/routes/_file.$uuid';
import * as Login from '@/routes/login';
import * as LoginResult from '@/routes/login-result';
import * as Logout from '@/routes/logout';
import { apiClient } from '@/shared/api/apiClient';
import { ROUTES, ROUTE_LOADER_IDS, SEARCH_PARAMS } from '@/shared/constants/routes';
import {
  Navigate,
  Route,
  ShouldRevalidateFunctionArgs,
  createBrowserRouter,
  createRoutesFromElements,
  redirect,
} from 'react-router-dom';
import { protectedRouteLoaderWrapper } from './auth';
import * as RootRoute from './routes/_root';

export const router = createBrowserRouter(
  createRoutesFromElements(
    <>
      <Route
        path="/"
        id={ROUTE_LOADER_IDS.ROOT}
        loader={RootRoute.loader}
        Component={RootRoute.Component}
        ErrorBoundary={RootRoute.ErrorBoundary}
      >
        <Route path="file">
          {/* Check that the browser is supported _before_ we try to load anything from the API */}
          <Route element={<BrowserCompatibilityLayoutRoute />}>
            <Route index element={<Navigate to={ROUTES.FILES} replace />} />
            <Route
              path=":uuid"
              id={ROUTE_LOADER_IDS.FILE}
              lazy={() => import('./routes/file.$uuid')}
              // We don't want to revalidate the initial file route because
              // we don't have any 2-way data flow setup for the file contents
              // But file metadata is handled in the pathless route below
              shouldRevalidate={() => false}
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
          {/* Resource routes - putting these outside the nested tree lets you hit them directly without having to load other data */}
          <Route
            path={ROUTES.EDUCATION_ENROLL}
            loader={async () => {
              // Check their status, then send them to the dashboard with the education dialog
              await apiClient.education.refresh();
              return redirect(`${ROUTES.FILES}?${SEARCH_PARAMS.DIALOG.KEY}=${SEARCH_PARAMS.DIALOG.VALUES.EDUCATION}`);
            }}
          />
          <Route path="files/:uuid" lazy={() => import('./routes/files.$uuid')} />
          <Route path="files/:uuid/sharing" lazy={() => import('./routes/files.$uuid.sharing')} />
          <Route
            path="teams/:teamUuid/files/create"
            lazy={() => import('./routes/teams.$teamUuid.files.create')}
            shouldRevalidate={() => false}
          />

          {/* Dashboard UI routes */}
          <Route
            id={ROUTE_LOADER_IDS.DASHBOARD}
            lazy={() => import('./routes/_dashboard')}
            shouldRevalidate={revalidateDashboard}
          >
            <Route index lazy={() => import('./routes/_dashboard.index')} />
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

            <Route path="teams">
              <Route index loader={() => redirect('/')} />
              <Route path="create" lazy={() => import('./routes/teams.create')} />
              <Route path=":teamUuid" lazy={() => import('./routes/teams.$teamUuid')}>
                <Route index lazy={() => import('./routes/teams.$teamUuid.index')} />
                <Route path="files/private" lazy={() => import('./routes/teams.$teamUuid.files.private')} />
                <Route path="members" lazy={() => import('./routes/teams.$teamUuid.members')} />
                <Route path="settings" lazy={() => import('./routes/teams.$teamUuid.settings')} />
                <Route path="connections" lazy={() => import('./routes/teams.$teamUuid.connections')}>
                  <Route index lazy={() => import('./routes/teams.$teamUuid.connections.index')} />
                </Route>
              </Route>
            </Route>
          </Route>
        </Route>

        <Route path="*" Component={Page404.Component} />
      </Route>
      <Route path={ROUTES.LOGIN} loader={Login.loader} />
      <Route path={ROUTES.LOGIN_RESULT} loader={LoginResult.loader} />
      <Route path={ROUTES.LOGOUT} loader={Logout.loader} action={Logout.action} />
    </>
  ),
  {
    future: {
      v7_fetcherPersist: true,
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

function revalidateDashboard({ currentUrl, nextUrl }: ShouldRevalidateFunctionArgs) {
  // const { pathname } = currentUrl;

  // if (currentUrl.pathname === ROUTES.TEAMS_CREATE || nextUrl.pathname === ROUTES.TEAMS_CREATE) {
  //   console.log('do not revlidate');
  //   return false;
  // }

  // // If you're coming from team members or connections, which are dialogs, don't revalidate.
  // // Just close immediately.
  // if (
  //   pathname.includes('teams/') &&
  //   (pathname.includes('members') || pathname.includes('connections') || pathname.includes('create'))
  // ) {
  //   return false;
  // }

  // // If you're not coming from a teams page, don't revalidate
  // if (!pathname.includes('teams/')) {
  //   return false;
  // }

  return true;
}
