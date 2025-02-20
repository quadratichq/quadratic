import { determineAndSetActiveTeam } from '@/dashboard/shared/getActiveTeam';
import { apiClient } from '@/shared/api/apiClient';
import { ROUTES, SEARCH_PARAMS } from '@/shared/constants/routes';
import type { LoaderFunctionArgs } from 'react-router-dom';
import { redirect } from 'react-router-dom';

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const url = new URL(request.url);

  // Get the active team
  const { teams } = await apiClient.teams.list();
  const { teamUuid } = await determineAndSetActiveTeam(teams, undefined);

  // Ensure the active team is _writeable_. If it's not, redirect them to the dashboard.
  // (They may have write access to another team, but not the 'active' one.)
  const team = teams.find(({ team }) => team.uuid === teamUuid);
  if (!team?.userMakingRequest.teamPermissions.includes('TEAM_EDIT')) {
    return redirect(
      `/?${SEARCH_PARAMS.SNACKBAR_MSG.KEY}=${encodeURIComponent('Failed to create file. You can only view this team.')}`
    );
  }

  // Are they trying to duplicate an example file? Do that.
  const example = url.searchParams.get('example');
  if (example) {
    return redirect(ROUTES.CREATE_FILE_EXAMPLE(teamUuid, example));
  }

  // Otherwise, start a new file by redirecting them to the file creation route
  const redirectUrl = ROUTES.CREATE_FILE(teamUuid, {
    // Are they creating a new file with a prompt?
    prompt: url.searchParams.get('prompt'),
    // Creating via this route is _always_ private
    private: true,
  });
  return redirect(redirectUrl);
};
