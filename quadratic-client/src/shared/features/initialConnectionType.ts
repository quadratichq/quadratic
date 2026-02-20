/**
 * When a user visits /files/create?initial-connection-type=XXX, we want to
 * auto-open the connection creation dialog once they land in the app. But they
 * may go through login, onboarding, and file creation redirects before getting
 * there. This module uses sessionStorage to persist that intent across redirects
 * within a single tab session, then provides it to the file route on load.
 */

import { ConnectionTypeSchema, type ConnectionType } from 'quadratic-shared/typesAndSchemasConnections';

const KEY = 'initialConnectionType';

/**
 * Stores the initial connection type from a URL's `initial-connection-type`
 * search param into sessionStorage. Call before auth so the value survives
 * login/signup/onboarding redirects within the same tab session.
 */
export function storeInitialConnectionType(url: URL): void {
  const value = url.searchParams.get('initial-connection-type');
  if (value) {
    sessionStorage.setItem(KEY, value);
  }
}

/**
 * Reads the stored initial connection type from sessionStorage without
 * removing it. Safe to call during React render (no side effects).
 */
export function getInitialConnectionType(): ConnectionType | undefined {
  const stored = sessionStorage.getItem(KEY);
  const parsed = stored ? ConnectionTypeSchema.safeParse(stored) : null;
  return parsed?.success ? parsed.data : undefined;
}

/**
 * Clears the stored initial connection type from sessionStorage.
 * Call from a useEffect to avoid side effects during render.
 */
export function clearInitialConnectionType(): void {
  sessionStorage.removeItem(KEY);
}
