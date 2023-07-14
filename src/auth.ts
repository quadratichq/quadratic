import { createAuth0Client, User } from '@auth0/auth0-spa-js';
import { LoaderFunction, LoaderFunctionArgs, redirect } from 'react-router-dom';

interface AuthProvider {
  isAuthenticated(): Promise<boolean>;
  user(): Promise<undefined | User>;
  signin(redirectTo: string): Promise<void>;
  handleSigninRedirect(): Promise<void>;
  signout(): Promise<void>;
  getToken(): any;
}

const domain = process.env.REACT_APP_AUTH0_DOMAIN || '';
const clientId = process.env.REACT_APP_AUTH0_CLIENT_ID || '';
// TODO do we need these?
const audience = process.env.REACT_APP_AUTH0_AUDIENCE;
const issuer = process.env.REACT_APP_AUTH0_ISSUER;

// let auth0Client: Awaited<ReturnType<typeof createAuth0Client>>;
let clientPromise: any; // TODO

async function getClient() {
  console.log('getClient() run');
  if (!clientPromise) {
    console.log('getClient() initializing...');
    clientPromise = createAuth0Client({
      domain,
      clientId,
      issuer,
      authorizationParams: {
        audience,
      },
    });
  }
  let client = await clientPromise;
  // apiClientSingleton.setAuth(auth0AuthProvider.getToken());
  console.log('getClient() return');
  return client;
}

export const auth0AuthProvider: AuthProvider = {
  async isAuthenticated() {
    let client = await getClient();
    return client.isAuthenticated();
  },
  async user() {
    let client = await getClient();
    let user = await client.getUser();
    return user;
  },
  async signin(redirectTo: string) {
    let client = await getClient();
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
      let client = await getClient();
      await client.handleRedirectCallback();
    }
  },
  async signout() {
    let client = await getClient();
    await client.logout();
  },
  async getToken() {
    let client = await getClient();
    let token = await client.getTokenSilently();
    return token;
  },
  //   async getTokken() {
  //     let client = await getClient();
  //     return client.getTokenSilently;
  //   },
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
    let isAuthenticated = await auth0AuthProvider.isAuthenticated();
    if (!isAuthenticated) {
      let params = new URLSearchParams();
      params.set('from', new URL(request.url).pathname);
      return redirect('/login?' + params.toString());
    }
    return loaderFn(loaderFnArgs);
  };
}
