import { Auth0Client, User, createAuth0Client } from '@auth0/auth0-spa-js';
import * as Sentry from '@sentry/browser';
import { LoaderFunction, LoaderFunctionArgs, redirect } from 'react-router-dom';
import { ROUTES } from './constants/routes';

const AUTH0_DOMAIN = process.env.REACT_APP_AUTH0_DOMAIN || '';
const AUTH0_CLIENT_ID = process.env.REACT_APP_AUTH0_CLIENT_ID || '';
const AUTH0_AUDIENCE = process.env.REACT_APP_AUTH0_AUDIENCE;
const AUTH0_ISSUER = process.env.REACT_APP_AUTH0_ISSUER;

// verify all AUTH0 env variables are set
if (!(AUTH0_DOMAIN && AUTH0_CLIENT_ID && AUTH0_AUDIENCE && AUTH0_ISSUER)) {
  const message = 'Auth0 variables are not configured correctly.';
  Sentry.captureEvent({
    message,
    level: Sentry.Severity.Fatal,
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
  /**
   * Tries to get a token for the current user. If the token is expired, it
   * redirects the user to auth0 to get re-authenticate and get a new token.
   */
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

    // If the user isn't authenciated, redirect them to login
    if (!isAuthenticated) {
      let params = new URLSearchParams();
      params.set('from', new URL(request.url).pathname);
      return redirect(ROUTES.LOGIN + '?' + params.toString());
    }

    // If the user is authenticated, make sure we have a valid token
    // before we load any of the app
    await authClient.getTokenOrRedirect();

    return loaderFn(loaderFnArgs);
  };
}

/**
 * In cases where we call the auth0 client and it redirects the user to the
 * auth0 website on its own (e.g. for `.login` and `.logout`, presumably via
 * manipulation `window.location`) we have to manually wait for the client
 * Why? Because even though auth0's client APIs are async, they seem to
 * complete immediately and our app's code continues before `window.location`
 * kicks in.
 *
 * So, in other words, this ensures our whole app pauses while the auth0 lib
 * does its thing and kicks the user over to auth0.com
 */
export function waitForAuth0ClientToRedirect() {
  return new Promise((resolve) => setTimeout(resolve, 10000));
}
