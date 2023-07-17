import React from 'react';
import {
  createBrowserRouter,
  Outlet,
  useRouteError,
  redirect,
  RouterProvider,
  createRoutesFromElements,
  Route,
  Navigate,
} from 'react-router-dom';
import { User } from '@auth0/auth0-spa-js';
import { authClient } from './auth';
import { debugLogAuth } from './debugFlags';
import { QuadraticAnalytics } from './quadratic/QuadraticAnalytics';
import { QuadraticAuth } from './quadratic/QuadraticAuth';
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
        <Route path="file" lazy={() => import('./App')} />

        <Route lazy={() => import('./Dashboard')}>
          <Route path="files" element={<Navigate to="/files/mine" replace />} />
          <Route path="files/mine" lazy={() => import('./dashboard/RouteMine')} />
          <Route path="files/examples" lazy={() => import('./dashboard/RouteExamples')} />
          <Route path="files/teams" lazy={() => import('./dashboard/RouteTeams')} />
          <Route path="account" lazy={() => import('./dashboard/RouteAccount')} />
          {/* TODO catch all for here? */}
        </Route>

        <Route path="*" element={<div>TODO Catch all route</div>} />
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
    <QuadraticAuth>
      <QuadraticAnalytics>
        <Outlet />
      </QuadraticAnalytics>
    </QuadraticAuth>
  );
}

function RootError() {
  let error = useRouteError();
  console.error(error);
  return <div>Oops. Something went wrong. Don't forget to add this component</div>;
}
