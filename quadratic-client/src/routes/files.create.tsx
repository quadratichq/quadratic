import { requireAuth } from '@/auth/auth';
import { apiClient } from '@/shared/api/apiClient';
import { ROUTES, SEARCH_PARAMS } from '@/shared/constants/routes';
import type { LoaderFunctionArgs } from 'react-router';
import { redirect } from 'react-router';

export const loader = async (loaderArgs: LoaderFunctionArgs) => {
  const { activeTeamUuid } = await requireAuth();

  const { request } = loaderArgs;
  const url = new URL(request.url);

  // Get the active team
  const { teams } = await apiClient.teams.list();

  // Ensure the active team is _writeable_. If it's not, redirect them to the dashboard.
  // (They may have write access to another team, but not the 'active' one.)
  const activeTeam = teams.find(({ team }) => team.uuid === activeTeamUuid);
  if (!activeTeam?.userMakingRequest.teamPermissions.includes('TEAM_EDIT')) {
    return redirect(
      `/?${SEARCH_PARAMS.SNACKBAR_MSG.KEY}=${encodeURIComponent('Failed to create file. You can only view this team.')}`
    );
  }

  // Are they trying to duplicate an example file? Do that.
  const example = url.searchParams.get('example');
  if (example) {
    return redirect(ROUTES.CREATE_FILE_EXAMPLE(activeTeamUuid, example));
  }

  // Otherwise, start a new file by redirecting them to the file creation route
  const redirectUrl = ROUTES.CREATE_FILE(activeTeamUuid, {
    // Are they creating a new file with a prompt?
    prompt: url.searchParams.get('prompt'),
    // Creating via this route is _always_ private unless explicitly stated
    private: url.searchParams.get('private') === 'false' ? false : true,
  });
  return redirect(redirectUrl);
};
