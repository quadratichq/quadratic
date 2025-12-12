import { apiClient } from '@/shared/api/apiClient';
import type { ApiTypes } from 'quadratic-shared/typesAndSchemas';
import type { LoaderFunctionArgs } from 'react-router';

/**
 * API route to fetch team data
 * Used by useTeamData hook when in file context
 */
export const loader = async ({ params }: LoaderFunctionArgs) => {
  const { teamUuid } = params as { teamUuid: string };

  if (!teamUuid) {
    return { ok: false, error: 'Team UUID is required' };
  }

  try {
    const teamData = await apiClient.teams.get(teamUuid);
    // Sort the users so the logged-in user is first in the list
    teamData.users.sort((a, b) => {
      const loggedInUser = teamData.userMakingRequest.id;
      if (a.id === loggedInUser && b.id !== loggedInUser) return -1;
      if (a.id !== loggedInUser && b.id === loggedInUser) return 1;
      return 0;
    });
    return { ok: true, data: teamData };
  } catch (error: any) {
    return { ok: false, error: error.message || 'Failed to load team data' };
  }
};

export type GetTeamData = {
  ok: boolean;
  data?: ApiTypes['/v0/teams/:uuid.GET.response'];
  error?: string;
};
