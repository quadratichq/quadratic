/* eslint-disable @typescript-eslint/no-unused-vars */
import type { AuthClient, User } from '@/auth/auth';
import { workOs } from '@/auth/useWorkOs';
import { captureEvent } from '@sentry/react';

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
// let clientPromise: ReturnType<typeof createClient> | null = null;
// function getClient(): ReturnType<typeof createClient> {
//   if (!clientPromise) {
//     const apiHostname = apiClient.auth.getApiHostname();
//     clientPromise = createClient(WORKOS_CLIENT_ID, {
//       redirectUri: window.location.origin + ROUTES.LOGIN_RESULT,
//       apiHostname,
//       https: !apiHostname.includes('localhost'),
//       devMode: false,
//     });
//   }
//   return clientPromise;
// }

export const workosClient: AuthClient = {
  /**
   * Return whether the user is authenticated and the session is valid.
   */
  isAuthenticated(): Promise<boolean> {
    return new Promise((resolve) => {
      if (!workOs.getUser) return resolve(false);
      const user = workOs.getUser();
      resolve(!!user);
    });
  },

  /**
   * Get the current authenticated user from Workos.
   */
  async user(): Promise<User | undefined> {
    return new Promise((resolve) => {
      if (!workOs.getUser) return resolve(undefined);
      const workOsUser = workOs.getUser();
      if (!workOsUser) return undefined;
      const user: User = {
        name: `${workOsUser.given_name ?? ''} ${workOsUser.family_name ?? ''}`.trim(),
        given_name: workOsUser.given_name ?? undefined,
        family_name: workOsUser.family_name ?? undefined,
        picture: workOsUser.picture ?? undefined,
        email: workOsUser.email ?? undefined,
        sub: workOsUser.sub ?? undefined,
      };
      return user;
    });
  },

  /**
   * Login the user in Workos and create a new session.
   */
  async login(args: { redirectTo: string; isSignupFlow?: boolean; href: string }): Promise<void> {
    // let state = undefined;
    // if (args.redirectTo && args.redirectTo !== '/') {
    //   state = {
    //     redirectTo: args.redirectTo,
    //   };
    // }
    // const callback = new URL(window.location.origin + ROUTES.LOGIN_RESULT);
    // try {
    //   const { url } = await apiClient.workos.login(callback.toString(), state ? JSON.stringify(state) : undefined);
    //   if (!url) throw new Error('Expected signInUrl to be defined in login');
    //   window.location.href = url;
    // } catch {}
  },

  /**
   * Handle the redirect from Workos after the user has logged in if
   * code and state are present in the query params.
   */
  async handleSigninRedirect(href: string): Promise<void> {
    // try {
    //   const url = new URL(href);
    //   const code = url.searchParams.get('code');
    //   const state = url.searchParams.get('state');
    //   if (!code || !state) {
    //     return;
    //   }
    //   url.searchParams.delete('code');
    //   const { pendingAuthenticationToken } = await apiClient.auth.authenticateWithCode({ code });
    //   if (pendingAuthenticationToken) {
    //     url.pathname = ROUTES.VERIFY_EMAIL;
    //     url.searchParams.set('pendingAuthenticationToken', pendingAuthenticationToken);
    //     window.location.assign(url.toString());
    //     await waitForAuthClientToRedirect();
    //   } else {
    //     let redirectTo = window.location.origin;
    //     const stateObj = JSON.parse(decodeURIComponent(state));
    //     if (!!stateObj && typeof stateObj === 'object') {
    //       if ('closeOnComplete' in stateObj && stateObj.closeOnComplete) {
    //         document.cookie = 'workos-has-session=true; SameSite=None; Secure; Path=/';
    //         window.close();
    //         return;
    //       }
    //       if ('redirectTo' in stateObj && !!stateObj.redirectTo && typeof stateObj.redirectTo === 'string') {
    //         redirectTo = stateObj.redirectTo;
    //       }
    //     }
    //     window.location.assign(redirectTo);
    //     await waitForAuthClientToRedirect();
    //   }
    // } catch {}
  },

  /**
   * Logout the user in Workos and terminate the singleton session.
   * Take the user back to the login page (as defined in the Workos).
   */
  async logout(): Promise<void> {
    if (!workOs.signOut) throw new Error('Not implemented');
    await workOs.signOut();
  },

  /**
   * Get the access token for the current authenticated user.
   * If the user is not authenticated, redirect to the login page.
   */
  async getTokenOrRedirect(skipRedirect?: boolean): Promise<string> {
    if (!workOs.getAccessToken || !workOs.signIn) {
      console.log('workOs.getAccessToken or workOs.signIn is not defined');
      return '';
    }
    await workOs.signIn();
    const token = await workOs.getAccessToken();
    if (token) return token;

    if (!skipRedirect) {
      workOs.signIn();
    }
    return token;
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

// const disposeClient = async () => {
//   const client = await getClient();
//   client.dispose();
//   clientPromise = null;
// };
