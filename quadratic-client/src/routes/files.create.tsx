import { requireAuth } from '@/auth/auth';
import { apiClient } from '@/shared/api/apiClient';
import { ROUTES, SEARCH_PARAMS } from '@/shared/constants/routes';
import { ConnectionTypeSchema } from 'quadratic-shared/typesAndSchemasConnections';
import type { LoaderFunctionArgs } from 'react-router';
import { redirect } from 'react-router';

export const loader = async (loaderArgs: LoaderFunctionArgs) => {
  const { activeTeamUuid } = await requireAuth(loaderArgs.request);

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
  const template = url.searchParams.get('template');
  url.searchParams.delete('template');
  if (template) {
    url.searchParams.delete('private');
    const additionalParams = url.searchParams.toString();
    return redirect(
      ROUTES.CREATE_FILE_FROM_TEMPLATE({
        teamUuid: activeTeamUuid,
        publicFileUrlInProduction: template,
        additionalParams,
      })
    );
  }

  // Otherwise, start a new file by redirecting them to the file creation route
  // Validate connection type from URL params
  const connectionTypeParam = url.searchParams.get('connection-type');
  const parsedConnectionType = connectionTypeParam ? ConnectionTypeSchema.safeParse(connectionTypeParam) : null;
  const redirectUrl = ROUTES.CREATE_FILE(activeTeamUuid, {
    // Are they creating a new file with a prompt?
    prompt: url.searchParams.get('prompt'),
    // Creating via this route is _always_ private unless explicitly stated
    private: url.searchParams.get('private') === 'false' ? false : true,
    // File to be fetched from iframe indexeddb for this chat-id from marketing site
    chatId: url.searchParams.get('chat-id') || null,
    // Connection context for AI analyst
    connectionUuid: url.searchParams.get('connection-uuid'),
    connectionType: parsedConnectionType?.success ? parsedConnectionType.data : null,
    connectionName: url.searchParams.get('connection-name'),
    // Auto-open connections dialog to create a specific connection type (validated in file.$uuid)
    initialConnectionType: url.searchParams.get('initial-connection-type'),
  });
  return redirect(redirectUrl);
};

export const Component = () => {
  return null;
};
