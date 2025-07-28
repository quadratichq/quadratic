import type { AuthClient, User } from '@/auth/auth';
import { waitForAuthClientToRedirect } from '@/auth/auth.helper';
import { apiClient } from '@/shared/api/apiClient';
import { ROUTES } from '@/shared/constants/routes';
import * as Sentry from '@sentry/react';
import { createClient } from '@workos-inc/authkit-js';

const WORKOS_CLIENT_ID = import.meta.env.VITE_WORKOS_CLIENT_ID || '';
const WORKOS_LOCAL_STORAGE_KEY = 'workos:refresh-token';

// verify all Workos env variables are set
if (!WORKOS_CLIENT_ID) {
  const message = 'Workos variables are not configured correctly.';
  Sentry.captureEvent({
    message,
    level: 'fatal',
  });
}

// Create the client as a module-scoped promise so all loaders will wait
// for this one single instance of client to resolve
let clientPromise: ReturnType<typeof createClient>;
function getClient(): ReturnType<typeof createClient> {
  if (!clientPromise) {
    clientPromise = createClient(WORKOS_CLIENT_ID, {
      redirectUri: window.location.origin + ROUTES.LOGIN_RESULT,
      devMode: true,
    });
  }
  return clientPromise;
}

export const workosClient: AuthClient = {
  /**
   * Return whether the user is authenticated and the session is valid.
   */
  async isAuthenticated(): Promise<boolean> {
    const client = await getClient();
    const user = client.getUser();
    return !!user;
  },

  /**
   * Get the current authenticated user from Workos.
   */
  async user(): Promise<User | undefined> {
    const client = await getClient();
    const workosUser = client.getUser();
    if (!workosUser) {
      return undefined;
    }
    const user: User = {
      name: `${workosUser.firstName} ${workosUser.lastName}`.trim(),
      given_name: workosUser.firstName ?? undefined,
      family_name: workosUser.lastName ?? undefined,
      picture: workosUser.profilePictureUrl ?? undefined,
      email: workosUser.email,
      sub: workosUser.id,
    };
    return user;
  },

  /**
   * Login the user in Workos and create a new session.
   * If `isSignupFlow` is true, the user will be redirected to the registration flow.
   */
  async login(redirectTo: string, isSignupFlow: boolean = false) {
    const url = new URL(window.location.origin + ROUTES.LOGIN);

    if (isSignupFlow) {
      url.searchParams.set('signup', 'true');
    } else {
      url.searchParams.delete('signup');
    }

    if (redirectTo && redirectTo !== '/') {
      url.searchParams.set('redirectTo', redirectTo);
    } else {
      url.searchParams.delete('redirectTo');
    }

    if (window.location.href !== url.toString()) {
      window.location.assign(url.toString());
    }

    return false;
  },

  /**
   * Handle the redirect from Workos after the user has logged in if
   * code and state are present in the query params.
   */
  async handleSigninRedirect() {
    try {
      const search = window.location.search;
      if (!search.includes('code=') || !search.includes('state=')) {
        return;
      }

      const url = new URL(window.location.href);
      const code = url.searchParams.get('code') || '';
      url.searchParams.delete('code');
      const response = await apiClient.auth.authenticateWithCode({ code });
      if (!response.refreshToken) {
        return;
      }
      localStorage.setItem(WORKOS_LOCAL_STORAGE_KEY, response.refreshToken);

      let redirectTo = window.location.origin;
      const state = url.searchParams.get('state');
      if (state) {
        const stateObj = JSON.parse(decodeURIComponent(state));
        if (
          !!stateObj &&
          typeof stateObj === 'object' &&
          'redirectTo' in stateObj &&
          !!stateObj.redirectTo &&
          typeof stateObj.redirectTo === 'string'
        ) {
          redirectTo = stateObj.redirectTo;
        }
      }

      window.location.assign(redirectTo);
      await waitForAuthClientToRedirect();
    } catch {}
  },

  /**
   * Logout the user in Workos and terminate the singleton session.
   * Take the user back to the login page (as defined in the Workos).
   */
  async logout() {
    const client = await getClient();
    client.signOut({ returnTo: window.location.origin });
    await waitForAuthClientToRedirect();
  },

  /**
   * Get the access token for the current authenticated user.
   * If the user is not authenticated, redirect to the login page.
   */
  async getTokenOrRedirect(skipRedirect?: boolean) {
    try {
      const client = await getClient();
      const token = await client.getAccessToken();
      return token;
    } catch (e) {
      if (!skipRedirect) {
        const { pathname, search } = new URL(window.location.href);
        await this.login(pathname + search);
      }
    }
    return '';
  },

  async loginWithPassword(args) {
    try {
      const response = await apiClient.auth.loginWithPassword({ email: args.email, password: args.password });
      if (!response.refreshToken) {
        return;
      }
      localStorage.setItem(WORKOS_LOCAL_STORAGE_KEY, response.refreshToken);
      window.location.assign(args.redirectTo);
      await waitForAuthClientToRedirect();
    } catch (e) {
      console.error(e);
    }
  },

  async signupWithPassword(args) {
    try {
      const response = await apiClient.auth.signupWithPassword({
        email: args.email,
        password: args.password,
        firstName: args.firstName,
        lastName: args.lastName,
      });
      if (!response.refreshToken) {
        return;
      }
      localStorage.setItem(WORKOS_LOCAL_STORAGE_KEY, response.refreshToken);
      window.location.assign(args.redirectTo);
      await waitForAuthClientToRedirect();
    } catch (e) {
      console.error(e);
    }
  },
};
