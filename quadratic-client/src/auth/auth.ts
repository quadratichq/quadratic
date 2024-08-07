import { Auth0Client, User, createAuth0Client } from '@auth0/auth0-spa-js';
import * as Sentry from '@sentry/react';
import { useEffect } from 'react';
import { LoaderFunction, LoaderFunctionArgs, redirect } from 'react-router-dom';
import { ROUTES } from '../shared/constants/routes';

const AUTH0_DOMAIN = import.meta.env.VITE_AUTH0_DOMAIN || '';
const AUTH0_CLIENT_ID = import.meta.env.VITE_AUTH0_CLIENT_ID || '';
const AUTH0_AUDIENCE = import.meta.env.VITE_AUTH0_AUDIENCE;
const AUTH0_ISSUER = import.meta.env.VITE_AUTH0_ISSUER;

// verify all AUTH0 env variables are set
if (!(AUTH0_DOMAIN && AUTH0_CLIENT_ID && AUTH0_AUDIENCE && AUTH0_ISSUER)) {
  const message = 'Auth0 variables are not configured correctly.';
  Sentry.captureEvent({
    message,
    level: 'fatal',
  });
}

// Create the client as a module-scoped promise so all loaders will wait
// for this one single instance of client to resolve
let auth0ClientPromise: Promise<Auth0Client>;
async function getClient() {
  if (!auth0ClientPromise) {
    auth0ClientPromise = createAuth0Client({
      domain: AUTH0_DOMAIN,
      clientId: AUTH0_CLIENT_ID,
      issuer: AUTH0_ISSUER,
      authorizationParams: {
        audience: AUTH0_AUDIENCE,
      },
      cacheLocation: 'localstorage',
      useRefreshTokens: true,
      // remove the subdomain from the cookie domain so that the ws server can access it
      cookieDomain: parseDomain(window.location.host),
    });
  }
  const auth0Client = await auth0ClientPromise;
  return auth0Client;
}

interface AuthClient {
  isAuthenticated(): Promise<boolean>;
  user(): Promise<undefined | User>;
  login(redirectTo: string, isSignupFlow?: boolean): Promise<void>;
  handleSigninRedirect(): Promise<void>;
  logout(): Promise<void>;
  getTokenOrRedirect(): Promise<string>;
}

export const authClient: AuthClient = {
  async isAuthenticated() {
    const client = await getClient();
    const isAuthenticated = await client.isAuthenticated();
    return isAuthenticated;
  },
  async user() {
    const client = await getClient();
    const user = await client.getUser();
    return user;
  },
  async login(redirectTo: string, isSignupFlow: boolean = false) {
    const client = await getClient();
    await client.loginWithRedirect({
      authorizationParams: {
        screen_hint: isSignupFlow ? 'signup' : 'login',
        redirect_uri:
          window.location.origin +
          ROUTES.LOGIN_RESULT +
          '?' +
          new URLSearchParams([['redirectTo', redirectTo]]).toString(),
      },
    });
    await waitForAuth0ClientToRedirect();
  },
  async handleSigninRedirect() {
    const query = window.location.search;
    if (query.includes('code=') && query.includes('state=')) {
      const client = await getClient();
      await client.handleRedirectCallback();
    }
  },
  async logout() {
    const client = await getClient();
    await client.logout({ logoutParams: { returnTo: window.location.origin } });
    await waitForAuth0ClientToRedirect();
  },
  /**
   * Tries to get a token for the current user from the auth0 client.
   * If the token is still valid, it'll pull it from a cache. If it’s expired,
   * it will fail and we will manually redirect the user to auth0 to re-authenticate
   * and get a new token.
   */
  async getTokenOrRedirect() {
    const client = await getClient();
    try {
      const token = await client.getTokenSilently();
      return token;
    } catch (e) {
      await this.login(new URL(window.location.href).pathname);
      return '';
    }
  },
};

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

    // If the user isn't authenciated, redirect them to login & preserve their
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
 * In cases where we call the auth0 client and it redirects the user to the
 * auth0 website (e.g. for `.login` and `.logout`, presumably via changing
 * `window.location`) we have to manually wait for the auth0 client.
 *
 * Why? Because even though auth0's client APIs are async, they seem to
 * complete immediately and our app's code continues before `window.location`
 * kicks in.
 *
 * So this function ensures our whole app pauses while the auth0 lib does its
 * thing and kicks the user over to auth0.com
 *
 * We only use this when we _want_ to pause everything and wait to redirect
 */
export function waitForAuth0ClientToRedirect() {
  return new Promise((resolve) => setTimeout(resolve, 10000));
}

/**
 * Utility function parse the domain from a url
 */
export function parseDomain(url: string): string {
  // check for classic URLs
  let matches = url.match(/([^.]*\.[^.]{2,3}(?:\.[^.]{2,3})?$)/);

  if (matches) {
    return '.' + matches[0];
  } else {
    // check for IP addresses or localhost (ignore ports) or just return the url
    return url.match(/(?:(?!:).)*/)![0] ?? url;
  }
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
