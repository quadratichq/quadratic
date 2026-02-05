import type { AuthClient, User } from '@/auth/auth';
import { waitForAuthClientToRedirect } from '@/auth/auth.helper';
import { VITE_AUTH_TYPE, VITE_ORY_HOST } from '@/env-vars';
import type { Session } from '@ory/kratos-client';
import { Configuration, FrontendApi } from '@ory/kratos-client';
import { captureEvent } from '@sentry/react';

// verify all Ory env variables are set (only when Ory auth is enabled)
if (VITE_AUTH_TYPE === 'ory' && !VITE_ORY_HOST) {
  const message = 'Ory variables are not configured correctly.';
  captureEvent({
    message,
    level: 'fatal',
  });
  throw new Error(message);
}

const config = new Configuration({
  basePath: VITE_ORY_HOST,
  baseOptions: {
    withCredentials: true,
  },
});

const sdk = new FrontendApi(config);

// singleton session
let session: Session | undefined;

/**
 * Get the current session from Ory.
 * If the session is not cached or expired, fetch a new one.
 * Return false if the session cannot be fetched.
 */
const getSession = async (): Promise<Session | false> => {
  // if the session exists and is not expired, return it
  if (session && session.expires_at && Date.parse(session.expires_at) > Date.now()) {
    return session;
  }

  try {
    session = (await sdk.toSession({ tokenizeAs: 'jwt_template' })).data;
    return session;
  } catch (e) {
    return false;
  }
};

export const oryClient: AuthClient = {
  /**
   * Return whether the user is authenticated and the session is valid.
   */
  async isAuthenticated(): Promise<boolean> {
    return (await getSession()) !== false;
  },

  /**
   * Get the current authenticated user from Ory.
   */
  async user(): Promise<User | undefined> {
    const session = await getSession();

    if (!session) return;

    const { first, last } = session.identity?.traits.name;
    const data = {
      name: `${first} ${last}`,
      given_name: first,
      family_name: last,
      email: session.identity?.traits.email,
      sub: session.identity?.id,
    };

    return data;
  },

  /**
   * Login the user in Ory and create a new session.
   * If `isSignupFlow` is true, the user will be redirected to the registration flow.
   */
  async login(args: { redirectTo: string; isSignupFlow?: boolean; href: string }) {
    const urlSegment = args.isSignupFlow ? 'registration' : 'login';
    const url = new URL(`${VITE_ORY_HOST}/self-service/${urlSegment}/browser`);
    url.searchParams.set('return_to', args.redirectTo);

    // redirect to the login/signup flow
    window.location.assign(url);

    await waitForAuthClientToRedirect();
  },

  /**
   * Currently this is a noop since state and code cannot both be present in the URL
   */
  async handleSigninRedirect() {},

  /**
   * Logout the user in Ory and terminate the singleton session.
   * Take the user back to the login page (as defined in the Ory config).
   */
  async logout() {
    const { data: flow } = await sdk.createBrowserLogoutFlow();

    // clear the singleton session
    session = undefined;

    window.location.assign(flow.logout_url);

    await waitForAuthClientToRedirect();
  },

  /**
   * Tries to get a token for the current user from the Ory client.
   * If the token is still valid, it'll pull it from a cache. If it's expired,
   * it will fail and we will manually redirect the user to ory to re-authenticate
   * and get a new token.
   */
  async getTokenOrRedirect(skipRedirect?: boolean, request?: Request) {
    try {
      const session = await getSession();
      if (session && session.tokenized) {
        return session.tokenized;
      } else {
        throw new Error('Session is not tokenized');
      }
    } catch (e) {
      if (!skipRedirect) {
        const href = request ? request.url : window.location.href;
        const { pathname, search } = new URL(href);
        await this.login({ redirectTo: pathname + search, href });
      }
    }
    return '';
  },
};
