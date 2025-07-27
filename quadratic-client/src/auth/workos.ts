import type { AuthClient, User } from '@/auth/auth';
import { waitForAuthClientToRedirect } from '@/auth/auth.helper';
import { ROUTES } from '@/shared/constants/routes';
import * as Sentry from '@sentry/react';
import { createClient } from '@workos-inc/authkit-js';

const WORKOS_CLIENT_ID = import.meta.env.VITE_WORKOS_CLIENT_ID || '';

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
      onRedirectCallback: (redirectParams) => {
        const state = redirectParams.state;
        if (!!state && typeof state === 'object' && 'redirectTo' in state) {
          const redirectTo = state.redirectTo;
          if (typeof redirectTo === 'string' && !!redirectTo) {
            window.location.assign(redirectTo);
            return;
          }
        }
      },
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
    const client = await getClient();
    const state = redirectTo
      ? {
          redirectTo:
            window.location.origin +
            ROUTES.LOGIN_RESULT +
            '?' +
            new URLSearchParams([['redirectTo', redirectTo]]).toString(),
        }
      : undefined;
    if (isSignupFlow) {
      await client.signUp({ state });
    } else {
      await client.signIn({ state });
    }
    await waitForAuthClientToRedirect();
  },

  /**
   * Handle the redirect from Workos after the user has logged in if
   * code and state are present in the query params.
   */
  async handleSigninRedirect() {
    const query = window.location.search;
    if (query.includes('code=') && query.includes('state=')) {
      await getClient();
      await waitForAuthClientToRedirect();
    }
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
};
