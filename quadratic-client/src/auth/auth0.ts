import type { AuthClient } from '@/auth/auth';
import { parseDomain, waitForAuthClientToRedirect } from '@/auth/auth.helper';
import { ROUTES, SEARCH_PARAMS } from '@/shared/constants/routes';
import type { Auth0Client } from '@auth0/auth0-spa-js';
import { createAuth0Client } from '@auth0/auth0-spa-js';
import { captureEvent } from '@sentry/react';

const AUTH0_DOMAIN = import.meta.env.VITE_AUTH0_DOMAIN || '';
const AUTH0_CLIENT_ID = import.meta.env.VITE_AUTH0_CLIENT_ID || '';
const AUTH0_AUDIENCE = import.meta.env.VITE_AUTH0_AUDIENCE;
const AUTH0_ISSUER = import.meta.env.VITE_AUTH0_ISSUER;

// verify all AUTH0 env variables are set
if (!(AUTH0_DOMAIN && AUTH0_CLIENT_ID && AUTH0_AUDIENCE && AUTH0_ISSUER)) {
  const message = 'Auth0 variables are not configured correctly.';
  captureEvent({
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
          new URLSearchParams([[SEARCH_PARAMS.REDIRECT_TO.KEY, redirectTo]]).toString(),
      },
    });
    await waitForAuthClientToRedirect();
  },
  async handleSigninRedirect(href: string) {
    const { searchParams } = new URL(href);
    if (searchParams.get('code') && searchParams.get('state')) {
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

  async loginWithPassword(_) {
    throw new Error('loginWithPassword called in Auth0');
  },
  async loginWithOAuth(_) {
    throw new Error('loginWithOAuth called in Auth0');
  },
  async signupWithPassword(_) {
    throw new Error('signupWithPassword called in Auth0');
  },
  async verifyEmail(_) {
    throw new Error('verifyEmail called in Auth0');
  },
  async sendResetPassword(_) {
    throw new Error('sendResetPassword called in Auth0');
  },
  async resetPassword(_) {
    throw new Error('resetPassword called in Auth0');
  },
  async sendMagicAuthCode(_) {
    throw new Error('sendMagicAuthCode called in Auth0');
  },
  async authenticateWithMagicCode(_) {
    throw new Error('authenticateWithMagicCode called in Auth0');
  },
};
