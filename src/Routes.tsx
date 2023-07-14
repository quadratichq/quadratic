import React from 'react';
import {
  createBrowserRouter,
  Outlet,
  useRouteError,
  redirect,
  // useLocation,
  // Form,
  Link,
  useRouteLoaderData,
  useFetcher,
  RouterProvider,
  createRoutesFromElements,
  Route,
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
        <Route index element={<div>TODO This should redirect to the dashboard</div>} />
        <Route path="file" lazy={() => import('./App')} />
        <Route path="files" lazy={() => import('./AppDashboard')} />
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
        <>
          <div
            style={{
              display: 'flex',
              gap: '1rem',
              alignItems: 'center',
              height: '50px',
              background: '#fff',
              justifyContent: 'space-between',
              padding: '0 16px',
              zIndex: '1000000',
              position: 'fixed',
              top: '10px',
              left: '25%',
              width: '50%',
              border: '1px solid #e9e9e9',
              boxShadow: '0 3px 6px rgba(0,0,0,.1)',
            }}
          >
            <span style={{ display: 'flex', gap: '1rem' }}>
              <Link to="/">Home</Link>
              <Link to="/file">App</Link>
              <Link to="/files">Dashboard</Link>
            </span>
            <AuthStatus />
          </div>
          <Outlet />
        </>
      </QuadraticAnalytics>
    </QuadraticAuth>
  );
}

function AuthStatus() {
  // Get our logged in user, if they exist, from the root route loader data
  let { user } = useRouteLoaderData('root') as RootLoaderData;
  let fetcher = useFetcher();

  if (!user) {
    return (
      <span>
        You are not logged in. <Link to="/login">Log in</Link>
      </span>
    );
  }

  let isLoggingOut = fetcher.formData != null;

  return (
    <div>
      <fetcher.Form method="post" action="/logout">
        {user.name}
        <button type="submit" disabled={isLoggingOut}>
          {isLoggingOut ? 'Signing out...' : 'Sign out'}
        </button>
      </fetcher.Form>
    </div>
  );
}

function RootError() {
  let error = useRouteError();
  console.error(error);
  return <div>Oops. Something went wrong. Don't forget to add this component</div>;
}
