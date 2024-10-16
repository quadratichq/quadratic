import { UrlParamsDevState } from '@/app/gridGL/pixiApp/urlParams/UrlParamsDev';
import { apiClient } from '@/shared/api/apiClient';
import { ConnectionType } from 'quadratic-shared/typesAndSchemasConnections';

// Any routes referenced outside of the root router are stored here
export const ROUTES = {
  LOGOUT: '/logout',
  LOGIN: '/login',
  LOGIN_WITH_REDIRECT: () => '/login?from=' + encodeURIComponent(window.location.pathname),
  SIGNUP_WITH_REDIRECT: () => '/login?signup&from=' + encodeURIComponent(window.location.pathname),
  LOGIN_RESULT: '/login-result',
  FILES_SHARED_WITH_ME: '/files/shared-with-me',
  FILE: (uuid: string) => `/file/${uuid}`,

  CREATE_FILE: (teamUuid: string, state?: UrlParamsDevState['insertAndRunCodeInNewSheet']) =>
    `/teams/${teamUuid}/files/create` +
    (state ? `?state=${btoa(JSON.stringify({ insertAndRunCodeInNewSheet: state }))}` : ''),
  CREATE_FILE_EXAMPLE: (teamUuid: string, publicFileUrlInProduction: string, isPrivate: boolean) =>
    `/teams/${teamUuid}/files/create?example=${publicFileUrlInProduction}${isPrivate ? '&private' : ''}`,
  CREATE_FILE_PRIVATE: (teamUuid: string, state?: UrlParamsDevState['insertAndRunCodeInNewSheet']) =>
    `/teams/${teamUuid}/files/create?private` +
    (state ? `&state=${btoa(JSON.stringify({ insertAndRunCodeInNewSheet: state }))}` : ''),
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
  // This is a way to navigate to a team route without necessariliy knowing
  // the teamUuid upfront. It’s useful from the app-side when you want to navigate
  // back to the dashboard.
  TEAM_SHORTCUT: {
    CONNECTIONS: `/?team-shortcut=connections`,
  },
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
  OPENAI: {
    CHAT: `${apiClient.getApiUrl()}/ai/openai/chat`,
    STREAM: `${apiClient.getApiUrl()}/ai/openai/chat/stream`,
  },
  ANTHROPIC: {
    CHAT: `${apiClient.getApiUrl()}/ai/anthropic/chat`,
    STREAM: `${apiClient.getApiUrl()}/ai/anthropic/chat/stream`,
  },
};
