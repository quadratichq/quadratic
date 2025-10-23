import type { AuthClient, User } from '@/auth/auth';
import { waitForAuthClientToRedirect } from '@/auth/auth.helper';
import { apiClient } from '@/shared/api/apiClient';
import { ROUTES, SEARCH_PARAMS } from '@/shared/constants/routes';
import { getRedirectTo } from '@/shared/utils/getRedirectToOrLoginResult';
import { captureEvent } from '@sentry/react';
import { createClient } from '@workos-inc/authkit-js';

const WORKOS_CLIENT_ID = import.meta.env.VITE_WORKOS_CLIENT_ID;

const OAUTH_POPUP_WIDTH = 500;
const OAUTH_POPUP_HEIGHT = 600;

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
    const token = await this.getTokenOrRedirect(true);
    if (token) {
      return true;
    }

    const user = await this.user();
    return !!user;
  },

  /**
   * Get the current authenticated user from Workos.
   */
  async user(): Promise<User | undefined> {
    document.cookie = 'workos-has-session=true; SameSite=None; Secure; Path=/';
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
   * If `isSignupFlow` is true, the user will be redirected to the registration flow.
   */
  async login(args: { redirectTo: string; isSignupFlow?: boolean; href: string }) {
    const url = new URL(window.location.origin + (args.isSignupFlow ? ROUTES.SIGNUP : ROUTES.LOGIN));

    if (args.redirectTo && args.redirectTo !== '/') {
      url.searchParams.set(SEARCH_PARAMS.REDIRECT_TO.KEY, encodeURIComponent(args.redirectTo));
    } else {
      url.searchParams.delete(SEARCH_PARAMS.REDIRECT_TO.KEY);
    }

    if (args.href !== url.toString()) {
      window.location.assign(url.toString());
      await waitForAuthClientToRedirect();
    }
  },

  /**
   * Handle the redirect from Workos after the user has logged in if
   * code and state are present in the query params.
   */
  async handleSigninRedirect(href: string) {
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
  async logout() {
    const client = await getClient();
    await client.signOut({ navigate: false });
    await disposeClient();
    // Clear the custom workos-has-session cookie
    document.cookie = 'workos-has-session=; Max-Age=0; Path=/; Secure; SameSite=None';
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
      await disposeClient();
      if (!skipRedirect) {
        const { pathname, search } = new URL(window.location.href);
        await this.login({ redirectTo: pathname + search, href: window.location.href });
      }
    }
    return '';
  },

  async loginWithPassword(args) {
    const { pendingAuthenticationToken } = await apiClient.auth.loginWithPassword(args);
    await handlePendingAuthenticationToken(pendingAuthenticationToken);
    await handleRedirectTo();
  },

  async loginWithOAuth(args) {
    if (await this.isAuthenticated()) {
      window.location.assign(args.redirectTo);
      await waitForAuthClientToRedirect();
    }

    // Handle OAuth in iframe
    else if (window.top && window.self !== window.top) {
      let attempts = 0;
      // Poll for authentication status
      const checkIsAuthenticated = async () => {
        attempts++;
        if (attempts > 40) {
          return;
        }

        const isAuthenticated = await this.isAuthenticated();
        if (isAuthenticated) {
          window.location.assign(args.redirectTo);
          await waitForAuthClientToRedirect();
          return;
        }

        setTimeout(checkIsAuthenticated, 3000);
      };
      checkIsAuthenticated();

      const oauthUrl = ROUTES.WORKOS_IFRAME_OAUTH({ provider: args.provider });
      const left = window.screenX + (window.outerWidth - OAUTH_POPUP_WIDTH) / 2;
      const top = window.screenY + (window.outerHeight - OAUTH_POPUP_HEIGHT) / 2;
      window.open(
        oauthUrl,
        '_blank',
        `width=${OAUTH_POPUP_WIDTH},height=${OAUTH_POPUP_HEIGHT},left=${left},top=${top},popup=true`
      );
    }
    // Handle OAuth in main window
    else {
      const oauthUrl = ROUTES.WORKOS_OAUTH({ provider: args.provider, redirectTo: args.redirectTo });
      window.location.assign(oauthUrl);
      await waitForAuthClientToRedirect();
    }
  },

  async signupWithPassword(args) {
    const { pendingAuthenticationToken } = await apiClient.auth.signupWithPassword(args);
    await handlePendingAuthenticationToken(pendingAuthenticationToken);
    await handleRedirectTo();
  },

  async verifyEmail(args) {
    await apiClient.auth.verifyEmail(args);
    await handleRedirectTo();
  },

  async sendResetPassword(args) {
    await apiClient.auth.sendResetPassword(args);
  },

  async resetPassword(args) {
    await apiClient.auth.resetPassword(args);
    await disposeClient();
  },
};

const disposeClient = async () => {
  const client = await getClient();
  client.dispose();
  clientPromise = null;
};

const handlePendingAuthenticationToken = async (pendingAuthenticationToken?: string) => {
  if (!pendingAuthenticationToken) {
    return;
  }

  const url = new URL(window.location.href);
  url.pathname = ROUTES.VERIFY_EMAIL;
  url.searchParams.set('pendingAuthenticationToken', pendingAuthenticationToken);
  window.location.assign(url.toString());
  await waitForAuthClientToRedirect();
};

const handleRedirectTo = async () => {
  await disposeClient();
  let redirectTo = getRedirectTo();
  if (redirectTo) {
    window.location.assign(redirectTo);
    await waitForAuthClientToRedirect();
  }
};
