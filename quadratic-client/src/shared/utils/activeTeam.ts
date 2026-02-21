// When a user lands on `/` we don't necessarily know what team they're trying
// to access, so these functions manage that lifecycle.
//
// When a user successfully loads/accesses a team, we save that team's
// uuid in localstorage. Then if/when the user hits the `/` route again, that's
// the team we send them to.
//
// On the dashboard the `/` route will redirect to `/teams/:uuid`, so all links
// in that context will be prefixed with the team being linked to.
// However, this does mean that the following could happen:
//
//   1. TAB1: User goes to `/`
//   2. TAB1: They are redirected to `/teams/foo`
//   3. TAB2: User goes to `/`
//   4. TAB2: They are redirected to `/teams/foo`
//   5. TAB2: User switches team to team `bar`
//   6. TAB1: User goes to URL and types `/`
//   7. TAB1: They will be redirected to `/teams/bar` (not `foo` which they were just looking at
//
// This is a bit of an edge case, but it's good to be aware of how this works.
import { apiClient } from '@/shared/api/apiClient';

const KEY = 'activeTeamUuid';

/**
 * Use this function in places where we want to reset the active team, like
 * when a user is removed from a team. Pass an empty string to clear the
 * active team so the app will resolve a new one (e.g. from the server).
 */
export function setActiveTeam(teamUuid: string) {
  if (teamUuid) {
    localStorage.setItem(KEY, teamUuid);
  } else {
    localStorage.removeItem(KEY);
  }
}

/**
 * We use a singleton promise here because it’s called in `requireAuth` and therefore
 * may be called in parallel across multiple route loaders. We need them all to
 * resolve at the same time.
 *
 * Notes:
 * 1. This is only used to initialize an active team. Once it resolves we don't
 *    really use it again (only used in loaders).
 * 2. This logic only applies to logged-in users, that's why it's only called
 *    in `requireAuth`. There's no such thing as an active team for unauth'd users
 */
let activeTeamPromise: Promise<string> | null = null;
export async function getOrInitializeActiveTeam(): Promise<string> {
  if (activeTeamPromise) return activeTeamPromise;

  activeTeamPromise = (async () => {
    // FYI: if there's a UUID in localstorage, it doesn’t necessarily mean the
    // user has access to it (maybe they were removed from a team, so they'll
    // get a 4xx in the UI).
    let teamUuidFromLocalStorage = localStorage.getItem(KEY);

    // Return immediately if we have it
    if (teamUuidFromLocalStorage) {
      return teamUuidFromLocalStorage;
    }

    // If there's no team in localstorage, the user is logged in but we don't
    // have a team they've recently accessed, we'll need to ensure they have a
    // team and then set it ourselves.
    const { teams } = await apiClient.teams.list();

    // If the user has access to at least one team, use the first one
    if (teams.length > 0) {
      const uuid = teams[0].team.uuid;
      localStorage.setItem(KEY, uuid);
      return uuid;
    }

    // Otherwise, they’re _likely_ a new user
    // (they could be a user who was removed from a team and now has 0 teams)
    // In either case, we'll create a new team for them automatically and use it.
    const newTeam = await apiClient.teams.create();
    const newTeamUuid = newTeam.uuid;
    localStorage.setItem(KEY, newTeamUuid);
    return newTeamUuid;
  })();

  try {
    return await activeTeamPromise;
  } finally {
    activeTeamPromise = null;
  }
}
