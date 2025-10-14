/* eslint-disable @typescript-eslint/no-unused-vars */
import type { AuthClient, User } from '@/auth/auth';
import { waitForAuthClientToRedirect } from '@/auth/auth.helper';
import { apiClient } from '@/shared/api/apiClient';
import { ROUTES } from '@/shared/constants/routes';
import { captureEvent } from '@sentry/react';
import { createClient } from '@workos-inc/authkit-js';

const WORKOS_CLIENT_ID = import.meta.env.VITE_WORKOS_CLIENT_ID;

// verify all Workos env variables are set
if (!WORKOS_CLIENT_ID) {
  const message = 'Workos variables are not configured correctly.';
  captureEvent({
    message,
    level: 'fatal',
  });
}

// Create the client as a module-scoped promise so all loaders will wait
// for this one single instance of client to resolve
let clientPromise: ReturnType<typeof createClient> | null = null;
function getClient(): ReturnType<typeof createClient> {
  if (!clientPromise) {
    const apiHostname = apiClient.auth.getApiHostname();
    clientPromise = createClient(WORKOS_CLIENT_ID, {
      redirectUri: window.location.origin + ROUTES.LOGIN_RESULT,
      apiHostname,
      https: !apiHostname.includes('localhost'),
      devMode: false,
    });
  }
  return clientPromise;
}

export const workosClient: AuthClient = {
  /**
   * Return whether the user is authenticated and the session is valid.
   */
  async isAuthenticated(): Promise<boolean> {
    await this.getTokenOrRedirect(true);
    const user = await this.user();
    return !!user;
  },

  /**
   * Get the current authenticated user from Workos.
   */
  async user(): Promise<User | undefined> {
    // document.cookie = 'workos-has-session=true; SameSite=None; Secure; Path=/';
    await disposeClient();
    const client = await getClient();
    await client.initialize();
    const workosUser = client.getUser();
    if (!workosUser) {
      return undefined;
    }
    const user: User = {
      name: `${workosUser.firstName ?? ''} ${workosUser.lastName ?? ''}`.trim(),
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
   */
  async login(args: { redirectTo: string; isSignupFlow?: boolean; href: string }): Promise<void> {
    let state = undefined;
    if (args.redirectTo && args.redirectTo !== '/') {
      state = {
        redirectTo: args.redirectTo,
      };
    }
    const callback = new URL(window.location.origin + ROUTES.LOGIN_RESULT);
    try {
      const { url } = await apiClient.workos.login(callback.toString(), state ? JSON.stringify(state) : undefined);
      if (!url) throw new Error('Expected signInUrl to be defined in login');
      window.location.href = url;
    } catch {}
  },

  /**
   * Handle the redirect from Workos after the user has logged in if
   * code and state are present in the query params.
   */
  async handleSigninRedirect(href: string): Promise<void> {
    try {
      const url = new URL(href);
      const code = url.searchParams.get('code');
      const state = url.searchParams.get('state');
      if (!code || !state) {
        return;
      }
      url.searchParams.delete('code');
      const { pendingAuthenticationToken } = await apiClient.auth.authenticateWithCode({ code });
      if (pendingAuthenticationToken) {
        url.pathname = ROUTES.VERIFY_EMAIL;
        url.searchParams.set('pendingAuthenticationToken', pendingAuthenticationToken);
        window.location.assign(url.toString());
        await waitForAuthClientToRedirect();
      } else {
        let redirectTo = window.location.origin;
        const stateObj = JSON.parse(decodeURIComponent(state));
        if (!!stateObj && typeof stateObj === 'object') {
          if ('closeOnComplete' in stateObj && stateObj.closeOnComplete) {
            document.cookie = 'workos-has-session=true; SameSite=None; Secure; Path=/';
            window.close();
            return;
          }
          if ('redirectTo' in stateObj && !!stateObj.redirectTo && typeof stateObj.redirectTo === 'string') {
            redirectTo = stateObj.redirectTo;
          }
        }
        window.location.assign(redirectTo);
        await waitForAuthClientToRedirect();
      }
    } catch {}
  },

  /**
   * Logout the user in Workos and terminate the singleton session.
   * Take the user back to the login page (as defined in the Workos).
   */
  async logout(): Promise<void> {
    const client = await getClient();
    client.signOut({ returnTo: window.location.origin, navigate: true });
  },

  /**
   * Get the access token for the current authenticated user.
   * If the user is not authenticated, redirect to the login page.
   */
  async getTokenOrRedirect(skipRedirect?: boolean): Promise<string> {
    try {
      const client = await getClient();
      const token = await client.getAccessToken();
      return token;
    } catch (e) {
      await disposeClient();
      if (!skipRedirect) {
        const url = new URL(window.location.href);
        await this.login({ redirectTo: url.toString(), href: window.location.href });
      }
    }
    return '';
  },
  async loginWithPassword(args) {
    throw new Error('Not implemented');
  },
  async loginWithOAuth(args) {
    throw new Error('Not implemented');
  },

  async signupWithPassword(args): Promise<void> {
    throw new Error('Not implemented');
  },

  async verifyEmail(args): Promise<void> {
    throw new Error('Not implemented');
  },

  async sendResetPassword(args): Promise<void> {
    throw new Error('Not implemented');
  },

  async resetPassword(args): Promise<void> {
    throw new Error('Not implemented');
  },
};

const disposeClient = async () => {
  const client = await getClient();
  client.dispose();
  clientPromise = null;
};
