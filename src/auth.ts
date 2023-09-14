import { Auth0Client, User, createAuth0Client } from '@auth0/auth0-spa-js';
import { LoaderFunction, LoaderFunctionArgs, redirect } from 'react-router-dom';
import {
  REACT_APP_AUTH0_AUDIENCE,
  REACT_APP_AUTH0_CLIENT_ID,
  REACT_APP_AUTH0_DOMAIN,
  REACT_APP_AUTH0_ISSUER,
} from './constants/env';
import { ROUTES } from './constants/routes';

// Create the client as a module-scoped promise so all loaders will wait
// for this one single instance of client to resolve
let auth0ClientPromise: Promise<Auth0Client>;
async function getClient() {
  if (!auth0ClientPromise) {
    auth0ClientPromise = createAuth0Client({
      domain: REACT_APP_AUTH0_DOMAIN,
      clientId: REACT_APP_AUTH0_CLIENT_ID,
      issuer: REACT_APP_AUTH0_ISSUER,
      authorizationParams: {
        audience: REACT_APP_AUTH0_AUDIENCE,
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
  getToken(): Promise<string | void>;
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
    // Not sure why this is the case, but manually waiting for this is what
    // makes it work. Auth0 will redirect once it actually does the logout,
    // otherwise this doesn't wait and it "logs out" too fast and you don't
    // actually log out
    await new Promise((resolve) => setTimeout(resolve, 10000));
  },
  async getToken() {
    const client = await getClient();

    try {
      const token = await client.getTokenSilently();
      return token;
    } catch (e) {
      return this.login(new URL(window.location.href).pathname);
    }
  },
};

/**
 * Utility function for use in route loaders.
 * If the user is not logged in and tries to access a protected route, we redirect
 * them to the login page with a `from` parameter that allows login to redirect back
 * to current page upon successful authentication
 */
export function protectedRouteLoaderWrapper(loaderFn: LoaderFunction): LoaderFunction {
  return async (loaderFnArgs: LoaderFunctionArgs) => {
    const { request } = loaderFnArgs;
    let isAuthenticated = await authClient.isAuthenticated();
    if (!isAuthenticated) {
      let params = new URLSearchParams();
      params.set('from', new URL(request.url).pathname);
      return redirect(ROUTES.LOGIN + '?' + params.toString());
    }
    return loaderFn(loaderFnArgs);
  };
}
