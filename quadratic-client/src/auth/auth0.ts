import type { AuthClient } from '@/auth/auth';
import { parseDomain, waitForAuthClientToRedirect } from '@/auth/auth.helper';
import { ROUTES } from '@/shared/constants/routes';
import type { Auth0Client } from '@auth0/auth0-spa-js';
import { createAuth0Client } from '@auth0/auth0-spa-js';
import * as Sentry from '@sentry/react';

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

export const auth0Client: AuthClient = {
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
    await waitForAuthClientToRedirect();
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
    await waitForAuthClientToRedirect();
  },
  /**
   * Tries to get a token for the current user from the auth0 client.
   * If the token is still valid, it'll pull it from a cache. If it’s expired,
   * it will fail and we will manually redirect the user to auth0 to re-authenticate
   * and get a new token.
   */
  async getTokenOrRedirect(skipRedirect?: boolean) {
    try {
      const client = await getClient();
      const token = await client.getTokenSilently();
      return token;
    } catch (e) {
      if (!skipRedirect) {
        const { pathname, search } = new URL(window.location.href);
        await this.login(pathname + search);
      }
      return '';
    }
  },
};
