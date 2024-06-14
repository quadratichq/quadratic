import { ACTIVE_TEAM_UUID_KEY } from '@/routes/_dashboard';
import { apiClient } from '@/shared/api/apiClient';
import { ROUTES } from '@/shared/constants/routes';
import { redirect } from 'react-router-dom';

/**
 * When somebody hits the root of the app, we need to figure out what team is
 * their “active” team and redirect them there.
 */
export const loader = async () => {
  // Is the active team in localstorage? redirect there
  let activeTeamUuid = localStorage.getItem(ACTIVE_TEAM_UUID_KEY);
  if (activeTeamUuid) {
    return redirect(ROUTES.TEAM(activeTeamUuid));
  }

  // If not, get a list of teams and redirect to the first (oldest) one
  const { teams } = await apiClient.teams.list();
  if (teams.length > 0) {
    activeTeamUuid = teams[0].team.uuid;
    localStorage.setItem(ACTIVE_TEAM_UUID_KEY, activeTeamUuid);
    return redirect(ROUTES.TEAM(activeTeamUuid));
  }

  // If we reach here, the network must've failed because everyone should have a team
  // So we will send them to a route where we know they don't need to know a team
  return redirect(ROUTES.EXAMPLES);
};
