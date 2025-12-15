import { useRootRouteLoaderData } from '@/routes/_root';
import { VERSION } from '@/shared/constants/appConstants';
import { ROUTE_LOADER_IDS } from '@/shared/constants/routes';
import { useEffect, useState } from 'react';
import { useMatches } from 'react-router';

type RouteDataWithClientDataKv =
  | {
      userMakingRequest?: { clientDataKv?: { lastSeenChangelogVersion?: string | null } };
    }
  | null
  | undefined;

/**
 * Hook to check if there's a new changelog entry the user hasn't seen
 * Uses the user's clientDataKv from the route loader with optimistic updates
 * Compares against the actual app VERSION instead of changelog.json
 * @returns { hasNewChangelog, markAsSeen } - hasNewChangelog is true if there's a new version, markAsSeen updates the server
 */
export function useChangelogNew() {
  const { isAuthenticated } = useRootRouteLoaderData();
  const matches = useMatches();

  // Optimistic state - when user marks as seen, immediately reflect in UI
  const [optimisticMarkedAsSeen, setOptimisticMarkedAsSeen] = useState(false);

  // Get clientDataKv from route loaders using useMatches to safely access data
  const fileMatch = matches.find((match) => match.id === ROUTE_LOADER_IDS.FILE);
  const dashboardMatch = matches.find((match) => match.id === ROUTE_LOADER_IDS.DASHBOARD);

  const fileRouteData = fileMatch?.data as RouteDataWithClientDataKv | undefined;
  const dashboardRouteData = dashboardMatch?.data as RouteDataWithClientDataKv | undefined;

  // Get last seen version from route loader data (prefer file route, fallback to dashboard)
  const lastSeenVersion =
    fileRouteData?.userMakingRequest?.clientDataKv?.lastSeenChangelogVersion ??
    dashboardRouteData?.userMakingRequest?.clientDataKv?.lastSeenChangelogVersion;

  // Use the actual app VERSION instead of changelog.json
  const currentVersion = VERSION;

  // Reset optimistic state when the route data catches up
  useEffect(() => {
    if (lastSeenVersion === currentVersion) {
      setOptimisticMarkedAsSeen(false);
    }
  }, [lastSeenVersion, currentVersion]);

  // Show as new for authenticated users if there's a current version and either:
  // 1. No last seen version (null/undefined/empty string)
  // 2. Last seen version doesn't match current version
  // But hide if user has optimistically marked as seen
  const hasNewChangelog =
    !optimisticMarkedAsSeen &&
    isAuthenticated &&
    currentVersion !== null &&
    currentVersion !== undefined &&
    (!lastSeenVersion ||
      (typeof lastSeenVersion === 'string' && lastSeenVersion.trim() === '') ||
      currentVersion !== lastSeenVersion);

  const markAsSeen = async () => {
    if (!currentVersion || !isAuthenticated) return;

    // Optimistically mark as seen immediately
    setOptimisticMarkedAsSeen(true);

    try {
      const { apiClient } = await import('@/shared/api/apiClient');
      await apiClient.user.clientDataKv.update({
        lastSeenChangelogVersion: currentVersion,
      });
    } catch (error) {
      console.warn('Failed to update changelog version:', error);
      // Revert optimistic update on error
      setOptimisticMarkedAsSeen(false);
    }
  };

  return { hasNewChangelog, markAsSeen };
}
