import { ROUTE_LOADER_IDS } from '@/shared/constants/routes';
import { useFileRouteLoaderData } from '@/shared/hooks/useFileRouteLoaderData';
import { isJsonObject } from '@/shared/utils/isJsonObject';
import type { ApiTypes } from 'quadratic-shared/typesAndSchemas';
import { useMemo } from 'react';
import { useFetchers, useRouteLoaderData } from 'react-router';

type TeamData = ApiTypes['/v0/teams/:uuid.GET.response'];

export function useTeamData() {
  // Try to get team data from dashboard route loader
  let dashboardTeam: TeamData | null = null;
  try {
    const dashboardData = useRouteLoaderData(ROUTE_LOADER_IDS.DASHBOARD) as
      | {
          activeTeam: TeamData;
        }
      | null
      | undefined;
    dashboardTeam = dashboardData?.activeTeam ?? null;
  } catch {
    dashboardTeam = null;
  }

  // Try to get team data from file route loader
  let fileTeam: TeamData | null = null;
  try {
    const fileData = useFileRouteLoaderData();
    fileTeam = fileData?.activeTeam ?? null;
  } catch {
    fileTeam = null;
  }

  // Get all fetchers to apply optimistic updates
  const fetchers = useFetchers();

  // Determine which data source to use and apply optimistic updates
  const teamData = useMemo(() => {
    const baseData = dashboardTeam ?? fileTeam ?? null;
    if (!baseData) return null;

    // Apply optimistic updates from fetchers
    let optimisticData = { ...baseData };

    // Watch for user role updates
    const updateFetchers = fetchers.filter(
      (f) => f.key?.startsWith('update-user-') && f.state !== 'idle' && isJsonObject(f.json)
    );
    if (updateFetchers.length > 0) {
      optimisticData.users = optimisticData.users.map((user) => {
        const userFetcher = updateFetchers.find((f) => f.key === `update-user-${user.id}`);
        if (userFetcher && isJsonObject(userFetcher.json) && 'role' in userFetcher.json) {
          return { ...user, role: userFetcher.json.role as typeof user.role };
        }
        return user;
      });
    }

    // Watch for user deletions
    const deleteFetchers = fetchers.filter((f) => f.key?.startsWith('delete-user-') && f.state !== 'idle');
    if (deleteFetchers.length > 0) {
      const deletingUserIds = deleteFetchers.map((f) => f.key?.replace('delete-user-', '')).filter(Boolean);
      optimisticData.users = optimisticData.users.filter((user) => !deletingUserIds.includes(String(user.id)));
    }

    return optimisticData;
  }, [dashboardTeam, fileTeam, fetchers]);

  return {
    teamData: teamData ? { activeTeam: teamData } : null,
    isLoading: false,
  };
}
