import { getOrInitializeActiveTeam } from '@/shared/utils/activeTeam';
import { useEffect } from 'react';

const AUTH_TYPE = import.meta.env.VITE_AUTH_TYPE;

export interface User {
  name?: string;
  given_name?: string;
  family_name?: string;
  picture?: string;
  email?: string;
  index?: number;
  sub?: string;
}

export type OAuthProvider = 'GoogleOAuth' | 'MicrosoftOAuth' | 'GitHubOAuth' | 'AppleOAuth';

export interface AuthClient {
  isAuthenticated(): Promise<boolean>;
  user(): Promise<undefined | User>;
  login(args: { redirectTo: string; isSignupFlow?: boolean; href: string }): Promise<void>;
  handleSigninRedirect(href: string): Promise<void>;
  logout(): Promise<void>;
  getTokenOrRedirect(skipRedirect?: boolean): Promise<string>;
  loginWithPassword(args: { email: string; password: string }): Promise<void>;
  loginWithOAuth(args: { provider: OAuthProvider; redirectTo: string }): Promise<void>;
  signupWithPassword(args: { email: string; password: string; firstName: string; lastName: string }): Promise<void>;
  verifyEmail(args: { pendingAuthenticationToken: string; code: string }): Promise<void>;
  sendResetPassword(args: { email: string }): Promise<void>;
  resetPassword(args: { token: string; password: string }): Promise<void>;
  sendMagicAuthCode(args: { email: string }): Promise<void>;
  authenticateWithMagicCode(args: { email: string; code: string }): Promise<void>;
}

let cachedAuthClient: Promise<AuthClient> | AuthClient | null = null;
const getAuthClient = async (): Promise<AuthClient> => {
  if (cachedAuthClient) {
    return await cachedAuthClient;
  }

  switch (AUTH_TYPE) {
    case 'auth0':
      cachedAuthClient = (await import('@/auth/auth0')).auth0Client;
      return cachedAuthClient;
    case 'ory':
      cachedAuthClient = (await import('@/auth/ory')).oryClient;
      return cachedAuthClient;
    case 'workos':
      cachedAuthClient = (await import('@/auth/workos')).workosClient;
      return cachedAuthClient;
    default:
      throw new Error(`Unsupported auth type in getAuthClient(): ${AUTH_TYPE}`);
  }
};

// Create a proxy client that lazily loads the actual client
export const authClient: AuthClient = {
  async isAuthenticated() {
    const client = await getAuthClient();
    return client.isAuthenticated();
  },
  async user() {
    const client = await getAuthClient();
    return client.user();
  },
  async login(args: { redirectTo: string; isSignupFlow?: boolean; href: string }) {
    const client = await getAuthClient();
    return client.login(args);
  },
  async handleSigninRedirect(href: string) {
    const client = await getAuthClient();
    return client.handleSigninRedirect(href);
  },
  async logout() {
    const client = await getAuthClient();
    return client.logout();
  },
  async getTokenOrRedirect(skipRedirect?: boolean) {
    const client = await getAuthClient();
    return client.getTokenOrRedirect(skipRedirect);
  },
  async loginWithPassword(args: { email: string; password: string }) {
    const client = await getAuthClient();
    return client.loginWithPassword(args);
  },
  async loginWithOAuth(args: { provider: OAuthProvider; redirectTo: string }) {
    const client = await getAuthClient();
    return client.loginWithOAuth(args);
  },
  async signupWithPassword(args: { email: string; password: string; firstName: string; lastName: string }) {
    const client = await getAuthClient();
    return client.signupWithPassword(args);
  },
  async verifyEmail(args: { pendingAuthenticationToken: string; code: string }) {
    const client = await getAuthClient();
    return client.verifyEmail(args);
  },
  async sendResetPassword(args: { email: string }) {
    const client = await getAuthClient();
    return client.sendResetPassword(args);
  },
  async resetPassword(args: { token: string; password: string }) {
    const client = await getAuthClient();
    return client.resetPassword(args);
  },
  async sendMagicAuthCode(args: { email: string }) {
    const client = await getAuthClient();
    return client.sendMagicAuthCode(args);
  },
  async authenticateWithMagicCode(args: { email: string; code: string }) {
    const client = await getAuthClient();
    return client.authenticateWithMagicCode(args);
  },
};

/**
 * Utility function for use in route loaders.
 * If the user is not logged in (or don't have an auth token) and tries to
 * access a protected route, we redirect them to the login page with a `from`
 * parameter that allows login to redirect back to current page upon successful
 * authentication.
 */
export async function requireAuth() {
  // If the user is authenticated, make sure we have a valid token
  // before we load any of the app
  await authClient.getTokenOrRedirect();

  // If the user is authenticated, make sure we have a team to work with
  const activeTeamUuid = await getOrInitializeActiveTeam();

  return { activeTeamUuid };
}

/**
 * Used in the dashboard and the app to ensure the user’s auth token always
 * remains valid. If at any point it expires, we redirect for a new one.
 *
 * Because this runs in both the app and the dashboard, we only want to check
 * for a token if the user is authenticated. If they're not, it's probably
 * a shared public file in the app that doesn't require auth to view.
 */
export function useCheckForAuthorizationTokenOnWindowFocus() {
  const fn = async () => {
    const isAuthenticated = await authClient.isAuthenticated();
    if (isAuthenticated) {
      await authClient.getTokenOrRedirect();
    }
  };
  useEffect(() => {
    window.addEventListener('focus', fn);
    return () => window.removeEventListener('focus', fn);
  }, []);
}
