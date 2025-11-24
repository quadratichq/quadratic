import { ROUTE_LOADER_IDS } from '@/shared/constants/routes';
import { useFileRouteLoaderData } from '@/shared/hooks/useFileRouteLoaderData';
import type { ApiTypes } from 'quadratic-shared/typesAndSchemas';
import { useMemo } from 'react';
import { useRouteLoaderData } from 'react-router';

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

  // Determine which data source to use
  const teamData = useMemo(() => {
    return dashboardTeam ?? fileTeam ?? null;
  }, [dashboardTeam, fileTeam]);

  return {
    teamData: teamData ? { activeTeam: teamData } : null,
    isLoading: false,
  };
}
