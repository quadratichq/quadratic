import type { UrlParamsDevState } from '@/app/gridGL/pixiApp/urlParams/UrlParamsDev';
import type { ConnectionType } from 'quadratic-shared/typesAndSchemasConnections';

// Any routes referenced outside of the root router are stored here
export const ROUTES = {
  LOGOUT: '/logout',
  LOGIN: '/login',
  LOGIN_WITH_REDIRECT: () => '/login?redirectTo=' + encodeURIComponent(window.location.pathname),
  SIGNUP_WITH_REDIRECT: () => '/login?signup&redirectTo=' + encodeURIComponent(window.location.pathname),
  LOGIN_CALLBACK: '/login-callback',
  LOGIN_RESULT: '/login-result',
  FILES_SHARED_WITH_ME: '/files/shared-with-me',
  FILE: ({ uuid, searchParams }: { uuid: string; searchParams?: string }) =>
    `/file/${uuid}${searchParams ? `?${searchParams}` : ''}`,
  FILE_DUPLICATE: (uuid: string) => `/file/${uuid}/duplicate`,
  FILE_HISTORY: (uuid: string) => `/file/${uuid}/history`,
  CREATE_FILE: (
    teamUuid: string,
    searchParams: {
      state?: UrlParamsDevState['insertAndRunCodeInNewSheet'];
      prompt?: string | null;
      private?: boolean;
      chatId?: string | null;
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
    if (searchParams.chatId) {
      url.searchParams.set('chat-id', searchParams.chatId);
    }

    return url.toString();
  },
  CREATE_FILE_EXAMPLE: ({
    teamUuid,
    publicFileUrlInProduction,
    additionalParams,
  }: {
    teamUuid: string;
    publicFileUrlInProduction: string;
    additionalParams: string;
  }) =>
    `/teams/${teamUuid}/files/create?example=${publicFileUrlInProduction}&private${
      additionalParams ? `&${additionalParams}` : ''
    }`,
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
  ACTIVE_TEAM_SETTINGS: `/team/settings`,
  EXAMPLES: '/examples',
  LABS: '/labs',

  API: {
    FILE: (uuid: string) => `/api/files/${uuid}`,
    FILE_SHARING: (uuid: string) => `/api/files/${uuid}/sharing`,
    CONNECTIONS: {
      POST: `/api/connections`,
      LIST: (teamUuid: string) => `/api/connections?team-uuid=${teamUuid}`,
      GET: ({ teamUuid, connectionUuid }: { teamUuid: string; connectionUuid: string }) =>
        `/api/connections?team-uuid=${teamUuid}&connection-uuid=${connectionUuid}`,
    },
  },

  WORKOS_OAUTH: ({
    redirectTo,
    provider,
  }: {
    redirectTo: string;
    provider: 'GoogleOAuth' | 'MicrosoftOAuth' | 'GitHubOAuth' | 'AppleOAuth';
  }) => {
    const clientId = import.meta.env.VITE_WORKOS_CLIENT_ID || '';
    const redirectUri = encodeURIComponent(window.location.origin + '/login-callback');
    const state = encodeURIComponent(JSON.stringify(redirectTo && redirectTo !== '/' ? { redirectTo } : {}));
    return `https://api.workos.com/user_management/authorize?client_id=${clientId}&provider=${provider}&redirect_uri=${redirectUri}&response_type=code&state=${state}`;
  },

  IFRAME_INDEXEDDB: '/iframe-indexeddb',
};

export const ROUTE_LOADER_IDS = {
  ROOT: 'root',
  FILE: 'file',
  DASHBOARD: 'dashboard',
};

export const SEARCH_PARAMS = {
  SHEET: { KEY: 'sheet' },
  DIALOG: { KEY: 'dialog', VALUES: { EDUCATION: 'education' } },
  SNACKBAR_MSG: { KEY: 'snackbar-msg' }, // VALUE can be any message you want to display
  SNACKBAR_SEVERITY: { KEY: 'snackbar-severity', VALUE: { ERROR: 'error' } },
  // Used to load a specific checkpoint (version history), e.g. /file/123?checkpoint=456
  CHECKPOINT: { KEY: 'checkpoint' },
};
