/* eslint-disable @typescript-eslint/no-unused-vars */
import type { AuthClient, User } from '@/auth/auth';
import { VITE_WORKOS_CLIENT_ID } from '@/env-vars';
import { ROUTES } from '@/shared/constants/routes';
import { captureEvent } from '@sentry/react';
import { createClient } from '@workos-inc/authkit-js';

// verify all Workos env variables are set
if (!VITE_WORKOS_CLIENT_ID) {
  const message = 'Workos variables are not configured correctly.';
  captureEvent({
    message,
    level: 'fatal',
  });
}

// Create the client as a module-scoped promise so all loaders will wait
// for this one single instance of client to resolve
let clientPromise: Promise<Awaited<ReturnType<typeof createClient>>> | null = null;
async function getClient() {
  if (!clientPromise) {
    clientPromise = (async () => {
      const client = await createClient(VITE_WORKOS_CLIENT_ID, {
        redirectUri: window.location.origin + ROUTES.LOGIN_RESULT,
      });
      await client.initialize();
      return client;
    })();
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
   * Get the current authenticated user from WorkOS AuthKit.
   */
  async user(): Promise<User | undefined> {
    const client = await getClient();
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
    const client = await getClient();
    let state = undefined;
    if (args.redirectTo && args.redirectTo !== '/') {
      state = {
        redirectTo: args.redirectTo,
      };
    }
    await client.signIn({
      state: state ? JSON.stringify(state) : undefined,
    });
  },

  /**
   * Handle the redirect from Workos after the user has logged in.
   * AuthKit SDK automatically handles the code exchange during initialization.
   */
  async handleSigninRedirect(href: string): Promise<void> {
    try {
      // Client initialization happens in getClient() and processes the callback
      const client = await getClient();
      if (!client.getUser()) {
        console.log('no user found after signin redirect');
        throw new Error('No user found after signin redirect');
      }

      const url = new URL(href);
      const state = url.searchParams.get('state');

      let redirectTo = window.location.origin;

      if (state) {
        try {
          const stateObj = JSON.parse(decodeURIComponent(state));
          if (!!stateObj && typeof stateObj === 'object') {
            if ('closeOnComplete' in stateObj && stateObj.closeOnComplete) {
              window.close();
              return;
            }
            if ('redirectTo' in stateObj && !!stateObj.redirectTo && typeof stateObj.redirectTo === 'string') {
              redirectTo = stateObj.redirectTo;
            }
          }
        } catch {
          // Invalid state, just use default redirectTo
        }
      }

      window.location.assign(redirectTo);
    } catch {}
  },

  /**
   * Logout the user via AuthKit and navigate to the login page.
   */
  async logout() {
    const client = await getClient();
    client.signOut({ returnTo: window.location.origin });
    disposeClient();
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
      if (!skipRedirect) {
        debugger;
        const url = new URL(window.location.href);
        await this.login({ redirectTo: url.toString(), href: window.location.href });
      }
    }
    return '';
  },

  // AuthKit uses hosted UI for all these flows
  async loginWithPassword(_args): Promise<void> {
    throw new Error('AuthKit uses hosted UI for password login');
  },
  async loginWithOAuth(_args): Promise<void> {
    throw new Error('AuthKit uses hosted UI for OAuth');
  },
  async signupWithPassword(_args): Promise<void> {
    throw new Error('AuthKit uses hosted UI for signup');
  },
  async verifyEmail(_args): Promise<void> {
    throw new Error('AuthKit handles email verification');
  },
  async sendResetPassword(_args): Promise<void> {
    throw new Error('AuthKit uses hosted UI for password reset');
  },
  async resetPassword(_args): Promise<void> {
    throw new Error('AuthKit uses hosted UI for password reset');
  },
};

const disposeClient = () => {
  clientPromise = null;
};
