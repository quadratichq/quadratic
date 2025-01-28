import { auth0Client } from '@/auth/auth0';
import { oryClient } from '@/auth/ory';
import { ROUTES } from '@/shared/constants/routes';
import { useEffect } from 'react';
import type { LoaderFunction, LoaderFunctionArgs } from 'react-router-dom';
import { redirect } from 'react-router-dom';

const AUTH_TYPE = import.meta.env.VITE_AUTH_TYPE || '';

export interface User {
  name?: string;
  given_name?: string;
  family_name?: string;
  picture?: string;
  email?: string;
  index?: number;
  sub?: string;
}

export interface AuthClient {
  isAuthenticated(): Promise<boolean>;
  user(): Promise<undefined | User>;
  login(redirectTo: string, isSignupFlow?: boolean): Promise<void>;
  handleSigninRedirect(): Promise<void>;
  logout(): Promise<void>;
  getTokenOrRedirect(): Promise<string>;
}

const getAuthClient = () => {
  switch (AUTH_TYPE) {
    case 'auth0':
      return auth0Client;
    case 'ory':
      return oryClient;
    default:
      throw new Error(`Unsupported auth type in getAuthClient(): ${AUTH_TYPE}`);
  }
};

export const authClient: AuthClient = getAuthClient();

/**
 * Utility function for use in route loaders.
 * If the user is not logged in (or don't have an auth token) and tries to
 * access a protected route, we redirect them to the login page with a `from`
 * parameter that allows login to redirect back to current page upon successful
 * authentication.
 */
export function protectedRouteLoaderWrapper(loaderFn: LoaderFunction): LoaderFunction {
  return async (loaderFnArgs: LoaderFunctionArgs) => {
    const { request } = loaderFnArgs;
    const isAuthenticated = await authClient.isAuthenticated();

    // If the user isn't authenticated, redirect them to login & preserve their
    // original request URL
    if (!isAuthenticated) {
      const originalRequestUrl = new URL(request.url);
      let searchParams = new URLSearchParams();
      searchParams.set('from', originalRequestUrl.pathname + originalRequestUrl.search);
      return redirect(ROUTES.LOGIN + '?' + searchParams.toString());
    }

    // If the user is authenticated, make sure we have a valid token
    // before we load any of the app
    await authClient.getTokenOrRedirect();

    return loaderFn(loaderFnArgs);
  };
}

/**
 * Used in the dashboard and the app to ensure the user’s auth token always
 * remains valid. If at any point it expires, we redirect for a new one.
 *
 * Because this runs in both the app and the dashboard, we only want to check
 * for a token if the user is authenticated. If they're not, it's probably
 * a shared public file in the app that doesn't require auth to view.
 */
export function useCheckForAuthorizationTokenOnWindowFocus() {
  const fn = async () => {
    const isAuthenticated = await authClient.isAuthenticated();
    if (isAuthenticated) {
      await authClient.getTokenOrRedirect();
    }
  };
  useEffect(() => {
    window.addEventListener('focus', fn);
    return () => window.removeEventListener('focus', fn);
  }, []);
}
