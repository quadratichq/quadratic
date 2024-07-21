// Any routes referenced outside of the root router are stored here
export const ROUTES = {
  LOGOUT: '/logout',
  LOGIN: '/login',
  LOGIN_WITH_REDIRECT: () => '/login?from=' + encodeURIComponent(window.location.pathname),
  SIGNUP_WITH_REDIRECT: () => '/login?signup&from=' + encodeURIComponent(window.location.pathname),
  LOGIN_RESULT: '/login-result',
  FILES_SHARED_WITH_ME: '/files/shared-with-me',
  FILE: (uuid: string) => `/file/${uuid}`,

  CREATE_FILE: (teamUuid: string) => `/teams/${teamUuid}/files/create`,
  CREATE_FILE_EXAMPLE: (teamUuid: string, publicFileUrlInProduction: string, isPrivate: boolean) =>
    `/teams/${teamUuid}/files/create?example=${publicFileUrlInProduction}${isPrivate ? '&private' : ''}`,
  CREATE_FILE_PRIVATE: (teamUuid: string) => `/teams/${teamUuid}/files/create?private`,
  TEAMS: `/teams`,
  TEAMS_CREATE: `/teams/create`,
  TEAM: (teamUuid: string) => `/teams/${teamUuid}`,
  TEAM_CONNECTIONS: (teamUuid: string) => `/teams/${teamUuid}/connections`,
  TEAM_CONNECTION_CREATE: (teamUuid: string, connectionType: string) =>
    `/teams/${teamUuid}/connections/create/${connectionType}`,
  TEAM_FILES: (teamUuid: string) => `/teams/${teamUuid}`,
  TEAM_FILES_PRIVATE: (teamUuid: string) => `/teams/${teamUuid}/files/private`,
  TEAM_MEMBERS: (teamUuid: string) => `/teams/${teamUuid}/members`,
  TEAM_SETTINGS: (teamUuid: string) => `/teams/${teamUuid}/settings`,
  EDIT_TEAM: (teamUuid: string) => `/teams/${teamUuid}/edit`,
  EXAMPLES: '/examples',
  ACCOUNT: '/account',

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
