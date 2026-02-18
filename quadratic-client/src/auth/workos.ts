import type { AuthClient, User } from '@/auth/auth';
import { waitForAuthClientToRedirect } from '@/auth/auth.helper';
import { VITE_AUTH_TYPE, VITE_WORKOS_CLIENT_ID } from '@/env-vars';
import { ROUTES } from '@/shared/constants/routes';
import { captureEvent, captureException } from '@sentry/react';
import { createClient, LoginRequiredError } from '@workos-inc/authkit-js';

// verify all Workos env variables are set (only when Workos auth is enabled)
if (VITE_AUTH_TYPE === 'workos' && !VITE_WORKOS_CLIENT_ID) {
  const message = 'Workos variables are not configured correctly.';
  captureEvent({
    message,
    level: 'fatal',
  });
  throw new Error(message);
}

// Helper function to extract the last two parts of a hostname
// e.g., "workos-attempt-3.quadratic-preview.com" -> "quadratic-preview.com"
function getBaseDomain(hostname: string): string {
  const parts = hostname.split('.');
  if (parts.length <= 2) {
    return hostname;
  }
  return parts.slice(-2).join('.');
}

type WorkOSClient = Awaited<ReturnType<typeof createClient>>;

let client: WorkOSClient | null = null;

// Shared promise prevents concurrent initialization (e.g., parallel route loaders)
let clientPromise: Promise<WorkOSClient> | null = null;

// Store the state from the redirect callback
let redirectState: Record<string, any> | null = null;

// Matches browser-level fetch failures (e.g., DNS, connectivity)
function isNetworkError(e: unknown): boolean {
  return e instanceof TypeError && (e.message.includes('Failed to fetch') || e.message.includes('NetworkError'));
}

// Creates and initializes the WorkOS client. createClient() calls
// client.initialize() internally, which exchanges the OAuth code
// if the current URL is a redirect callback.
async function createWorkosClient(): Promise<WorkOSClient> {
  const hostname = window.location.hostname;
  const isLocalhost = hostname === 'localhost' || hostname === '127.0.0.1';
  const newClient = await createClient(VITE_WORKOS_CLIENT_ID, {
    redirectUri: window.location.origin + ROUTES.LOGIN_RESULT,
    apiHostname: isLocalhost ? undefined : `authenticate.${getBaseDomain(hostname)}`,
    https: true,
    onBeforeAutoRefresh: () => true,
    onRedirectCallback: (params) => {
      redirectState = params.state;
    },
  });
  if (!newClient) throw new Error('Failed to create WorkOS client');
  return newClient;
}

// Best-effort retry on transient network errors. In most cases the OAuth
// code is still valid because the request never reached the server, but if
// the connection dropped mid-flight the code may already be consumed and
// the retry will fail with an auth error — callers should handle that.
async function initializeClientWithRetry(): Promise<WorkOSClient> {
  try {
    return await createWorkosClient();
  } catch (firstError) {
    if (!isNetworkError(firstError)) throw firstError;
    console.warn('WorkOS client initialization failed with network error, retrying…', firstError);
    await new Promise((resolve) => setTimeout(resolve, 1000));
    try {
      return await createWorkosClient();
    } catch (retryError) {
      console.error('WorkOS client retry also failed (original error logged above):', retryError);
      throw retryError;
    }
  }
}

// Returns the singleton WorkOS client, initializing it on first call.
// Multiple concurrent callers (e.g., parallel route loaders) share
// the same promise. On failure the promise is cleared so the next
// call can retry with a fresh initialization attempt.
async function getClient(): Promise<WorkOSClient> {
  if (client) {
    return client;
  }
  if (!clientPromise) {
    clientPromise = initializeClientWithRetry();
  }
  try {
    client = await clientPromise;
    return client;
  } catch (e) {
    clientPromise = null;
    throw e;
  }
}

// Peek at redirect state without clearing it
function peekRedirectState(): { redirectTo?: string; closeOnComplete?: boolean } | null {
  return redirectState;
}

// Get and clear redirect state
export function getAndClearRedirectState(): { redirectTo?: string; closeOnComplete?: boolean } | null {
  const state = redirectState;
  redirectState = null; // Clear after reading
  return state;
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
    const { redirectTo, isSignupFlow } = args;
    const client = await getClient();

    // Only include state if we have a redirectTo that's not '/'
    const options: { state?: any } = {};
    if (redirectTo && redirectTo !== '/') {
      options.state = { redirectTo };
    }

    if (isSignupFlow) {
      await client.signUp(options);
    } else {
      await client.signIn(options);
    }
  },

  /**
   * Handle the redirect from Workos after the user has logged in.
   * AuthKit SDK automatically handles the code exchange during initialization.
   * This function only validates the signin; the caller is responsible for redirecting.
   */
  async handleSigninRedirect(href: string): Promise<void> {
    try {
      const client = await getClient();
      if (!client.getUser()) {
        throw new Error('No user found after signin redirect');
      }

      // Handle special case: if state includes closeOnComplete, close the window
      // Use peek here so the state is preserved for login-result.tsx to use for redirect
      const state = peekRedirectState();
      if (state && 'closeOnComplete' in state && state.closeOnComplete) {
        getAndClearRedirectState(); // Clear state before closing
        window.close();
        return;
      }
    } catch (error) {
      console.error('WorkOS signin redirect failed:', error);
      throw error;
    }
  },

  /**
   * Logout the user via AuthKit and navigate to the login page.
   */
  async logout() {
    const client = await getClient();
    // Must use navigate: false to get Promise<void> instead of void
    // This waits for server logout to complete before redirecting
    await client.signOut({ returnTo: window.location.origin, navigate: false });
    window.location.href = window.location.origin;
  },

  /**
   * Get the access token for the current authenticated user.
   * If the user is not authenticated, redirect to the login page.
   */
  async getTokenOrRedirect(skipRedirect?: boolean, request?: Request): Promise<string> {
    try {
      const client = await getClient();
      const token = await client.getAccessToken();
      return token;
    } catch (e) {
      if (e instanceof LoginRequiredError) {
        if (!skipRedirect) {
          const href = request ? request.url : window.location.href;
          const url = new URL(href);
          await this.login({ redirectTo: url.toString(), href });
          await waitForAuthClientToRedirect();
        }
      } else {
        captureException(e, {
          tags: { context: 'workos-token-refresh' },
          extra: { skipRedirect, documentHidden: document.hidden },
        });
        if (!skipRedirect) {
          const href = request ? request.url : window.location.href;
          const url = new URL(href);
          await this.login({ redirectTo: url.toString(), href });
          await waitForAuthClientToRedirect();
        }
      }
    }
    return '';
  },
};
