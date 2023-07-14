import type { LoaderFunctionArgs } from 'react-router-dom';
import React from 'react';
import {
  createBrowserRouter,
  Outlet,
  useRouteError,
  redirect,
  useLocation,
  Form,
  Link,
  useRouteLoaderData,
  useFetcher,
  RouterProvider,
} from 'react-router-dom';
import { QuadraticAnalytics } from './quadratic/QuadraticAnalytics';
import { QuadraticAuth } from './quadratic/QuadraticAuth';
import { User } from '@auth0/auth0-spa-js';
import { auth0AuthProvider, protectedRouteLoaderWrapper } from './auth';
import { QuadraticLoading } from './ui/loading/QuadraticLoading';
import apiClientSingleton from './api-client/apiClientSingleton';

type RootLoaderData = {
  isAuthenticated: boolean;
  user?: User;
};

const router = createBrowserRouter([
  {
    id: 'root',
    path: '/',
    // Root route always provides the user (if logged in)
    async loader(): Promise<RootLoaderData> {
      let isAuthenticated = await auth0AuthProvider.isAuthenticated();
      let user = await auth0AuthProvider.user();
      console.log('/ <loader>: isAuthenticated: %s', isAuthenticated);
      return { isAuthenticated, user };
    },
    errorElement: <RootErrorElement />,
    Component: Layout,
    children: [
      {
        index: true,
        Component: PublicPage,
      },
      {
        path: 'file',
        lazy: () => import('./App'),
      },
      // <Route path="files" lazy={() => import('./AppDashboard')} />
      {
        path: 'login',
        action: loginAction,
        async loader() {
          let isAuthenticated = await auth0AuthProvider.isAuthenticated();
          console.log('/login <loader>: isAuthenticated: %s', isAuthenticated);
          if (isAuthenticated) {
            return redirect('/');
          }
          return null;
        },
        Component: LoginPage,
      },
      {
        path: 'protected',
        loader: protectedRouteLoaderWrapper(async ({ request }: LoaderFunctionArgs) => {
          return { files: await apiClientSingleton.getFiles() };
        }),
        // async loader({ request }) {
        //   let isAuthenticated = await auth0AuthProvider.isAuthenticated();
        //   console.log('/protected <loader>: isAuthenticated: %s', isAuthenticated);
        //   if (!isAuthenticated) {
        //     let params = new URLSearchParams();
        //     params.set('from', new URL(request.url).pathname);
        //     return redirect('/login?' + params.toString());
        //   }
        //   return null;
        // },
        lazy: () => import('./AppDashboard'),
        // Component: () => <div>Protected</div>,
      },
    ],
  },
  // Resource routes
  {
    path: '/login-result',
    async loader() {
      await auth0AuthProvider.handleSigninRedirect();
      let isAuthenticated = await auth0AuthProvider.isAuthenticated();
      if (isAuthenticated) {
        let redirectTo = new URLSearchParams(window.location.search).get('redirectTo') || '/';
        return redirect(redirectTo);
      }
      return redirect('/');
    },
    Component: () => null,
  },
  {
    path: '/logout',
    async action() {
      // We signout in a "resource route" that we can hit from a fetcher.Form
      await auth0AuthProvider.signout();
      return redirect('/');
    },
  },
]);

export const Routes = () => <RouterProvider router={router} fallbackElement={<QuadraticLoading />} />;

function LoginPage() {
  let location = useLocation();
  let params = new URLSearchParams(location.search);
  let from = params.get('from') || '/';

  // TODO automatically redirect them right here

  return (
    <div>
      <p>You must log in to view the page at {from}</p>

      <Form method="post" replace>
        <input type="hidden" name="redirectTo" value={from} />
        <button type="submit" name="type" value="redirect">
          Login with Redirect
        </button>
      </Form>
    </div>
  );
}

async function loginAction({ request }: LoaderFunctionArgs) {
  let formData = await request.formData();
  let redirectTo = (formData.get('redirectTo') as string | null) || '/';
  await auth0AuthProvider.signin(redirectTo);
  return null;
}

function RootErrorElement() {
  let error = useRouteError();
  console.error(error);
  return <div>Oops. Something went wrong. Don't forget to add this component</div>;
}

function PublicPage() {
  return <div>Public page</div>;
}
// const Root = () => (
//   <QuadraticAuth>
//     <QuadraticAnalytics>
//       <Outlet />
//     </QuadraticAnalytics>
//   </QuadraticAuth>
// );

function Layout() {
  return (
    <QuadraticAuth>
      <QuadraticAnalytics>
        <>
          <AuthStatus />

          <ul>
            <li>
              <Link to="/">Public Page</Link>
            </li>
            <li>
              <Link to="/protected">Protected Page</Link>
            </li>
          </ul>

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
    return <p>You are not logged in.</p>;
  }

  let isLoggingOut = fetcher.formData != null;

  return (
    <div>
      <p>Welcome {user.name}!</p>
      <fetcher.Form method="post" action="/logout">
        <button type="submit" disabled={isLoggingOut}>
          {isLoggingOut ? 'Signing out...' : 'Sign out'}
        </button>
      </fetcher.Form>
    </div>
  );
}
