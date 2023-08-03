import { Auth0Client, User, createAuth0Client } from '@auth0/auth0-spa-js';
import * as Sentry from '@sentry/browser';
import { LoaderFunction, LoaderFunctionArgs, redirect } from 'react-router-dom';

const domain = process.env.REACT_APP_AUTH0_DOMAIN || '';
const clientId = process.env.REACT_APP_AUTH0_CLIENT_ID || '';
const audience = process.env.REACT_APP_AUTH0_AUDIENCE;
const issuer = process.env.REACT_APP_AUTH0_ISSUER;
if (!(domain && clientId && audience && issuer)) {
  const message = 'Auth0 variables are not configured correctly.';
  Sentry.captureEvent({
    message,
    level: Sentry.Severity.Fatal,
  });
}

// Create the client as a module-scoped promise so all loaders will wait
// for this one single isntance of client to resolve
let auth0ClientPromise: Promise<Auth0Client>;
async function getClient() {
  if (!auth0ClientPromise) {
    auth0ClientPromise = createAuth0Client({
      domain,
      clientId,
      issuer,
      authorizationParams: {
        audience,
      },
    });
  }
  const auth0Client = await auth0ClientPromise;
  return auth0Client;
}

interface AuthClient {
  isAuthenticated(): Promise<boolean>;
  user(): Promise<undefined | User>;
  login(redirectTo: string): Promise<void>;
  handleSigninRedirect(): Promise<void>;
  logout(): Promise<void>;
  getToken(): Promise<string>;
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
  async login(redirectTo: string) {
    const client = await getClient();
    await client.loginWithRedirect({
      authorizationParams: {
        redirect_uri:
          window.location.origin + '/login-result?' + new URLSearchParams([['redirectTo', redirectTo]]).toString(),
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
    await client.logout();
    // Not sure why this is the case, but manually waiting for this is what
    // makes it work. Auth0 will redirect once it actually does the logout,
    // otherwise this doesn't wait and it "logs out" too fast and you don't
    // actually log out
    await new Promise((resolve) => setTimeout(resolve, 20000));
  },
  async getToken() {
    const client = await getClient();
    const token = await client.getTokenSilently();
    return token;
  },
};

/**
 * Utility function for use in route loaders.
 * If the user is not logged in and tries to access a protected route, we redirect
 * them to `/login` with a `from` parameter that allows login to redirect back
 * to current page upon successful authentication
 */
export function protectedRouteLoaderWrapper(loaderFn: LoaderFunction): LoaderFunction {
  return async (loaderFnArgs: LoaderFunctionArgs) => {
    const { request } = loaderFnArgs;
    let isAuthenticated = await authClient.isAuthenticated();
    if (!isAuthenticated) {
      let params = new URLSearchParams();
      params.set('from', new URL(request.url).pathname);
      return redirect('/login?' + params.toString());
    }
    return loaderFn(loaderFnArgs);
  };
}
