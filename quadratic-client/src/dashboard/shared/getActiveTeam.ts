import { ACTIVE_TEAM_UUID_KEY } from '@/routes/_dashboard';
import { apiClient } from '@/shared/api/apiClient';
import * as Sentry from '@sentry/react';

// TODO: explain this
// It's implicit what team is currently active. This is the function that
// tells us what is most likely the currently active team.
// Only once we do a get of the team do we know for sure the user has access to it.
export default async function getActiveTeam(
  teams: Awaited<ReturnType<typeof apiClient.teams.list>>['teams'],
  teamUuidFromUrl: string | undefined
) {
  let teamCreated = false;

  /**
   * Determine what the active team is
   */
  let initialActiveTeamUuid = undefined;
  // const uuidFromUrl = params.teamUuid;
  const uuidFromLocalStorage = localStorage.getItem(ACTIVE_TEAM_UUID_KEY);

  // FYI: if you have a UUID in the URL or localstorage, it doesn’t mean you
  // have access to it (maybe you were removed from a team, so it’s a 404)
  // So we have to ensure we A) have a UUID, and B) it's in the list of teams
  // we have access to from the server.

  // 1) Check the URL for a team UUID. If there's one, use that as that's
  //    explicitly what the user is trying to look at
  if (teamUuidFromUrl) {
    initialActiveTeamUuid = teamUuidFromUrl;

    // 2) Check localstorage for a team UUID
    // If what's in localstorage is not in the list of teams from the server —
    // e.g. you lost access to a team — we'll skip this
  } else if (uuidFromLocalStorage && teams.find((team) => team.team.uuid === uuidFromLocalStorage)) {
    initialActiveTeamUuid = uuidFromLocalStorage;

    // 3) There's no default preference (yet), so pick the 1st one in the API
  } else if (teams.length > 0) {
    initialActiveTeamUuid = teams[0].team.uuid;

    // 4) There are no teams in the API, so we will create one
  } else if (teams.length === 0) {
    const newTeam = await apiClient.teams.create({ name: 'My Team' });
    initialActiveTeamUuid = newTeam.uuid;
    teamCreated = true;
  }

  // This should never happen, but if it does, we'll log it to sentry
  if (initialActiveTeamUuid === undefined) {
    Sentry.captureEvent({
      message: 'No active team was found or could be created.',
      level: 'fatal',
    });
    throw new Error('No active team could be found or created.');
  }

  return {
    teamUuid: initialActiveTeamUuid,
    teamCreated,
  };
}
