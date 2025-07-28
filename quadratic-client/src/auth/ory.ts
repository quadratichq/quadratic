import type { AuthClient, User } from '@/auth/auth';
import { waitForAuthClientToRedirect } from '@/auth/auth.helper';
import type { Session } from '@ory/kratos-client';
import { Configuration, FrontendApi } from '@ory/kratos-client';
import * as Sentry from '@sentry/react';

const ORY_HOST = import.meta.env.VITE_ORY_HOST;

// verify all Ory env variables are set
if (!ORY_HOST) {
  const message = 'Ory variables are not configured correctly.';
  Sentry.captureEvent({
    message,
    level: 'fatal',
  });
}

const config = new Configuration({
  basePath: ORY_HOST,
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
  async login(redirectTo: string, isSignupFlow: boolean = false) {
    const urlSegment = isSignupFlow ? 'registration' : 'login';
    const url = new URL(`${ORY_HOST}/self-service/${urlSegment}/browser`);
    url.searchParams.set('return_to', redirectTo);

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
   * If the token is still valid, it'll pull it from a cache. If it’s expired,
   * it will fail and we will manually redirect the user to auth0 to re-authenticate
   * and get a new token.
   */
  async getTokenOrRedirect(skipRedirect?: boolean) {
    try {
      const session = await getSession();
      if (session && session.tokenized) {
        return session.tokenized;
      } else {
        throw new Error('Session is not tokenized');
      }
    } catch (e) {
      if (!skipRedirect) {
        const { pathname, search } = new URL(window.location.href);
        await this.login(pathname + search);
      }
    }
    return '';
  },

  async loginWithPassword(_) {
    throw new Error('loginWithPassword called in Ory');
  },
  async signupWithPassword(_) {
    throw new Error('signupWithPassword called in Ory');
  },
};
