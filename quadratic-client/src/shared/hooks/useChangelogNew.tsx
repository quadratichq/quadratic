import { useRootRouteLoaderData } from '@/routes/_root';
import changelogData from '@/shared/constants/changelog.json';
import { ROUTE_LOADER_IDS } from '@/shared/constants/routes';
import { useRevalidator } from 'react-router';
import { useMatches } from 'react-router';

const CHANGELOG_ENTRIES = changelogData as Array<{ version: string }>;

type RouteDataWithClientDataKv =
  | {
      userMakingRequest?: { clientDataKv?: { lastSeenChangelogVersion?: string | null } };
    }
  | null
  | undefined;

/**
 * Hook to check if there's a new changelog entry the user hasn't seen
 * Uses the user's clientDataKv from the route loader
 * @returns { hasNewChangelog, markAsSeen } - hasNewChangelog is true if there's a new version, markAsSeen updates the server
 */
export function useChangelogNew() {
  const { isAuthenticated } = useRootRouteLoaderData();
  const revalidator = useRevalidator();
  const matches = useMatches();

  // Get clientDataKv from route loaders using useMatches to safely access data
  const fileMatch = matches.find((match) => match.id === ROUTE_LOADER_IDS.FILE);
  const dashboardMatch = matches.find((match) => match.id === ROUTE_LOADER_IDS.DASHBOARD);

  const fileRouteData = fileMatch?.data as RouteDataWithClientDataKv | undefined;
  const dashboardRouteData = dashboardMatch?.data as RouteDataWithClientDataKv | undefined;

  // Get last seen version from route loader data (prefer file route, fallback to dashboard)
  const lastSeenVersion =
    fileRouteData?.userMakingRequest?.clientDataKv?.lastSeenChangelogVersion ??
    dashboardRouteData?.userMakingRequest?.clientDataKv?.lastSeenChangelogVersion;

  const latestVersion = CHANGELOG_ENTRIES.length > 0 ? CHANGELOG_ENTRIES[0].version : null;

  // Show as new for authenticated users if there's a latest version and either:
  // 1. No last seen version (null/undefined/empty string)
  // 2. Last seen version doesn't match latest version
  const hasNewChangelog =
    isAuthenticated &&
    latestVersion !== null &&
    (!lastSeenVersion ||
      (typeof lastSeenVersion === 'string' && lastSeenVersion.trim() === '') ||
      latestVersion !== lastSeenVersion);

  const markAsSeen = async () => {
    if (!latestVersion || !isAuthenticated) return;

    try {
      const { apiClient } = await import('@/shared/api/apiClient');
      await apiClient.user.clientDataKv.update({
        lastSeenChangelogVersion: latestVersion,
      });

      // Revalidate route loaders to sync with server
      revalidator.revalidate();
    } catch (error) {
      console.warn('Failed to update changelog version:', error);
    }
  };

  return { hasNewChangelog, markAsSeen };
}
