import type { UrlParamsDevState } from '@/app/gridGL/pixiApp/urlParams/UrlParamsDev';
import type { ConnectionType } from 'quadratic-shared/typesAndSchemasConnections';

const apiUrl = import.meta.env.VITE_QUADRATIC_API_URL;

// Any routes referenced outside of the root router are stored here
export const ROUTES = {
  LOGOUT: '/logout',
  LOGIN: '/login',
  LOGIN_WITH_REDIRECT: () => '/login?from=' + encodeURIComponent(window.location.pathname),
  SIGNUP_WITH_REDIRECT: () => '/login?signup&from=' + encodeURIComponent(window.location.pathname),
  LOGIN_RESULT: '/login-result',
  FILES_SHARED_WITH_ME: '/files/shared-with-me',
  FILE: (uuid: string) => `/file/${uuid}`,

  CREATE_FILE: (
    teamUuid: string,
    searchParams: {
      state?: UrlParamsDevState['insertAndRunCodeInNewSheet'];
      prompt?: string | null;
      private?: boolean;
    } = {}
  ) => {
    let url = new URL(window.location.origin + `/teams/${teamUuid}/files/create`);

    if (searchParams.state) {
      url.searchParams.set('state', btoa(JSON.stringify({ insertAndRunCodeInNewSheet: searchParams.state })));
    }
    if (searchParams.prompt) {
      url.searchParams.set('prompt', searchParams.prompt);
    }
    if (searchParams.private) {
      url.searchParams.set('private', 'true');
    }

    return url.toString();
  },
  CREATE_FILE_EXAMPLE: (teamUuid: string, publicFileUrlInProduction: string) =>
    `/teams/${teamUuid}/files/create?example=${publicFileUrlInProduction}&private`,
  TEAMS: `/teams`,
  TEAMS_CREATE: `/teams/create`,
  TEAM: (teamUuid: string) => `/teams/${teamUuid}`,
  TEAM_CONNECTIONS: (teamUuid: string) => `/teams/${teamUuid}/connections`,
  TEAM_CONNECTION_CREATE: (teamUuid: string, connectionType: ConnectionType) =>
    `/teams/${teamUuid}/connections?initial-connection-type=${connectionType}`,
  TEAM_CONNECTION: (teamUuid: string, connectionUuid: string, connectionType: ConnectionType) =>
    `/teams/${teamUuid}/connections?initial-connection-uuid=${connectionUuid}&initial-connection-type=${connectionType}`,
  TEAM_FILES: (teamUuid: string) => `/teams/${teamUuid}`,
  TEAM_FILES_PRIVATE: (teamUuid: string) => `/teams/${teamUuid}/files/private`,
  TEAM_MEMBERS: (teamUuid: string) => `/teams/${teamUuid}/members`,
  TEAM_SETTINGS: (teamUuid: string) => `/teams/${teamUuid}/settings`,
  EDIT_TEAM: (teamUuid: string) => `/teams/${teamUuid}/edit`,
  EXAMPLES: '/examples',
  ACCOUNT: '/account',
  LABS: '/labs',

  API: {
    FILE: (uuid: string) => `/api/files/${uuid}`,
    FILE_SHARING: (uuid: string) => `/api/files/${uuid}/sharing`,
    CONNECTIONS: `/api/connections`,
  },
};

export const ROUTE_LOADER_IDS = {
  ROOT: 'root',
  FILE: 'file',
  DASHBOARD: 'dashboard',
};

export const SEARCH_PARAMS = {
  DIALOG: { KEY: 'dialog', VALUES: { EDUCATION: 'education' } },
  SNACKBAR_MSG: { KEY: 'snackbar-msg' }, // VALUE can be any message you want to display
  SNACKBAR_SEVERITY: { KEY: 'snackbar-severity', VALUE: { ERROR: 'error' } },
};

export const AI = {
  BEDROCK: {
    CHAT: `${apiUrl}/ai/bedrock/chat`,
    STREAM: `${apiUrl}/ai/bedrock/chat/stream`,
    ANTHROPIC: {
      CHAT: `${apiUrl}/ai/bedrock/anthropic/chat`,
      STREAM: `${apiUrl}/ai/bedrock/anthropic/chat/stream`,
    },
  },
  ANTHROPIC: {
    CHAT: `${apiUrl}/ai/anthropic/chat`,
    STREAM: `${apiUrl}/ai/anthropic/chat/stream`,
  },
  OPENAI: {
    CHAT: `${apiUrl}/ai/openai/chat`,
    STREAM: `${apiUrl}/ai/openai/chat/stream`,
  },
};
