import { useRootRouteLoaderData } from '@/routes/_root';
import { apiClient } from '@/shared/api/apiClient';
import changelogData from '@/shared/constants/changelog.json';
import { ROUTE_LOADER_IDS } from '@/shared/constants/routes';
import useLocalStorage from '@/shared/hooks/useLocalStorage';
import { useEffect, useState } from 'react';
import { useRouteLoaderData } from 'react-router';

const CHANGELOG_STORAGE_KEY = 'changelog_last_seen_version';
const CHANGELOG_ENTRIES = changelogData as Array<{ version: string }>;

/**
 * Hook to check if there's a new changelog entry the user hasn't seen
 * Uses the user's clientDataKv from the database, with localStorage as fallback
 * @returns [hasNewChangelog, markAsSeen] - hasNewChangelog is true if there's a new version, markAsSeen marks the latest as seen
 */
export function useChangelogNew(): [boolean, () => void] {
  const { isAuthenticated } = useRootRouteLoaderData();
  const [serverLastSeenVersion, setServerLastSeenVersion] = useState<string | null | undefined>(undefined);

  // Try to get clientDataKv from file route loader (if in file context)
  // useRouteLoaderData returns undefined if the route doesn't exist, so this is safe
  const fileRouteData = useRouteLoaderData(ROUTE_LOADER_IDS.FILE) as
    | { userMakingRequest?: { clientDataKv?: { lastSeenChangelogVersion?: string } } }
    | undefined;

  const fileServerLastSeenVersion = fileRouteData?.userMakingRequest?.clientDataKv?.lastSeenChangelogVersion;

  // Fetch user clientDataKv if authenticated and we don't have it from file route
  useEffect(() => {
    if (isAuthenticated && !fileServerLastSeenVersion) {
      // We could fetch it here, but for now we'll rely on localStorage
      // The server will be updated when markAsSeen is called
      setServerLastSeenVersion(null);
    } else {
      setServerLastSeenVersion(fileServerLastSeenVersion);
    }
  }, [isAuthenticated, fileServerLastSeenVersion]);

  // Use localStorage as fallback (for unauthenticated users or when server data isn't available)
  const [localLastSeenVersion, setLocalLastSeenVersion] = useLocalStorage<string | null>(
    CHANGELOG_STORAGE_KEY,
    serverLastSeenVersion || null
  );

  // Prioritize server value - if server value is empty/null/undefined, treat as "not seen" (show as new)
  // Only use localStorage if server value is explicitly not available AND we're not authenticated
  const lastSeenVersion =
    serverLastSeenVersion !== undefined ? serverLastSeenVersion : isAuthenticated ? null : localLastSeenVersion;

  const latestVersion = CHANGELOG_ENTRIES.length > 0 ? CHANGELOG_ENTRIES[0].version : null;
  // Show as new if there's a latest version and either:
  // 1. No last seen version (null/undefined/empty string)
  // 2. Last seen version doesn't match latest version
  const hasNewChangelog =
    latestVersion !== null &&
    (!lastSeenVersion ||
      (typeof lastSeenVersion === 'string' && lastSeenVersion.trim() === '') ||
      latestVersion !== lastSeenVersion);

  // Sync server value to localStorage when it changes
  useEffect(() => {
    if (serverLastSeenVersion && serverLastSeenVersion !== localLastSeenVersion) {
      setLocalLastSeenVersion(serverLastSeenVersion);
    }
  }, [serverLastSeenVersion, localLastSeenVersion, setLocalLastSeenVersion]);

  const markAsSeen = async () => {
    if (!latestVersion) return;

    // Update localStorage immediately for instant UI feedback
    setLocalLastSeenVersion(latestVersion);

    // Update server if authenticated
    if (isAuthenticated) {
      try {
        await apiClient.user.clientDataKv.update({
          lastSeenChangelogVersion: latestVersion,
        });
      } catch (error) {
        // If update fails, keep the localStorage value
        console.warn('Failed to update changelog version on server:', error);
      }
    }
  };

  return [hasNewChangelog, markAsSeen];
}
