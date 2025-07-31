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
      onRedirectCallback: async ({ state }) => {
        console.log('onRedirectCallback', state);
        if (state) {
          if ('oauthKey' in state) {
            const oauthKey = state.oauthKey;
            if (oauthKey && typeof oauthKey === 'string') {
              localStorage.setItem(oauthKey, 'complete');
              window.close();
            }
          }

          if ('redirectTo' in state && !!state.redirectTo && typeof state.redirectTo === 'string') {
            window.location.assign(state.redirectTo);
            await waitForAuthClientToRedirect();
          }
        }
      },
    });
  }
  return clientPromise;
}

export const workosClient: AuthClient = {
  /**
   * Return whether the user is authenticated and the session is valid.
   */
  async isAuthenticated(): Promise<boolean> {
    document.cookie = 'workos-has-session=true; SameSite=None; Secure; Path=/';
    const client = await getClient();
    await client.initialize();
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
  async login(redirectTo: string, isSignupFlow: boolean = false) {
    const url = new URL(window.location.origin + (isSignupFlow ? ROUTES.SIGNUP : ROUTES.LOGIN));

    if (redirectTo && redirectTo !== '/') {
      url.searchParams.set(SEARCH_PARAMS.REDIRECT_TO.KEY, encodeURIComponent(redirectTo));
    } else {
      url.searchParams.delete(SEARCH_PARAMS.REDIRECT_TO.KEY);
    }

    if (window.location.href !== url.toString()) {
      window.location.assign(url.toString());
      await waitForAuthClientToRedirect();
    }
  },

  /**
   * Handle the redirect from Workos after the user has logged in if
   * code and state are present in the query params.
   */
  async handleSigninRedirect() {
    try {
      console.log('handleSigninRedirect - window.location.href:', window.location.href);
      console.log('handleSigninRedirect - window.location.origin:', window.location.origin);
      console.log('handleSigninRedirect - window.location.search:', window.location.search);
      const url = new URL(window.location.href);
      console.log('handleSigninRedirect', url);
      console.log('handleSigninRedirect - full href:', window.location.href);
      console.log('handleSigninRedirect - search params:', url.search);
      console.log('handleSigninRedirect - all search params:', [...url.searchParams.entries()]);

      const code = url.searchParams.get('code');
      const state = url.searchParams.get('state');
      console.log('handleSigninRedirect', code, state);
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
          if ('oauthKey' in stateObj) {
            const oauthKey = stateObj.oauthKey;
            if (oauthKey && typeof oauthKey === 'string') {
              localStorage.setItem(oauthKey, 'complete');
              window.close();
              return;
            }
          }

          if ('redirectTo' in stateObj && !!stateObj.redirectTo && typeof stateObj.redirectTo === 'string') {
            redirectTo = stateObj.redirectTo;
          }
        }

        window.location.assign(redirectTo);
        await waitForAuthClientToRedirect();
      }
    } catch {}
    await disposeClient();
  },

  /**
   * Logout the user in Workos and terminate the singleton session.
   * Take the user back to the login page (as defined in the Workos).
   */
  async logout() {
    const client = await getClient();
    await client.signOut({ navigate: false });
    window.location.assign(window.location.origin + ROUTES.LOGIN);
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
    const { pendingAuthenticationToken } = await apiClient.auth.loginWithPassword({
      email: args.email,
      password: args.password,
    });
    await handlePendingAuthenticationToken(pendingAuthenticationToken);
    await handleRedirectTo();
    await disposeClient();
  },

  async loginWithOAuth(args) {
    const isInIframe = window.self !== window.top;
    if (isInIframe) {
      const oauthKey = `${args.provider}-${crypto.randomUUID()}`;

      const checkForCompletion = async () => {
        console.log('checkForCompletion', oauthKey);
        if (localStorage.getItem(oauthKey) === 'complete') {
          localStorage.removeItem(oauthKey);
          window.location.assign(args.redirectTo);
          await waitForAuthClientToRedirect();
        } else {
          setTimeout(checkForCompletion, 500);
        }
      };
      checkForCompletion();

      const oauthUrl = ROUTES.WORKOS_IFRAME_OAUTH({ provider: args.provider, oauthKey });
      const left = window.screenX + (window.outerWidth - OAUTH_POPUP_WIDTH) / 2;
      const top = window.screenY + (window.outerHeight - OAUTH_POPUP_HEIGHT) / 2;
      window.open(
        oauthUrl,
        '_blank',
        `width=${OAUTH_POPUP_WIDTH},height=${OAUTH_POPUP_HEIGHT},left=${left},top=${top},popup=true`
      );
    } else {
      const oauthUrl = ROUTES.WORKOS_OAUTH({ provider: args.provider, redirectTo: args.redirectTo });
      window.location.assign(oauthUrl);
      await waitForAuthClientToRedirect();
    }
  },

  async signupWithPassword(args) {
    const { pendingAuthenticationToken } = await apiClient.auth.signupWithPassword({
      email: args.email,
      password: args.password,
      firstName: args.firstName,
      lastName: args.lastName,
    });
    await handlePendingAuthenticationToken(pendingAuthenticationToken);
    await handleRedirectTo();
    await disposeClient();
  },

  async verifyEmail(args) {
    await apiClient.auth.verifyEmail({
      pendingAuthenticationToken: args.pendingAuthenticationToken,
      code: args.code,
    });
    await handleRedirectTo();
    await disposeClient();
  },

  async sendResetPassword(args) {
    await apiClient.auth.sendResetPassword({ email: args.email });
  },

  async resetPassword(args) {
    await apiClient.auth.resetPassword({ token: args.token, password: args.password });
    await handleRedirectTo();
    await disposeClient();
  },

  async sendMagicAuthCode(args) {
    const { pendingAuthenticationToken } = await apiClient.auth.sendMagicAuthCode({ email: args.email });
    await handlePendingAuthenticationToken(pendingAuthenticationToken);
    await disposeClient();
  },

  async authenticateWithMagicCode(args) {
    const { pendingAuthenticationToken } = await apiClient.auth.authenticateWithMagicCode({
      email: args.email,
      code: args.code,
    });
    await handlePendingAuthenticationToken(pendingAuthenticationToken);
    await handleRedirectTo();
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
  let redirectTo = getRedirectTo();
  if (redirectTo) {
    window.location.assign(redirectTo);
    await waitForAuthClientToRedirect();
  }
};
