// Any routes referenced outside of the root router are stored here
export const ROUTES = {
  LOGOUT: '/logout',
  LOGIN: '/login',
  LOGIN_WITH_REDIRECT: () => '/login?from=' + encodeURIComponent(window.location.pathname),
  SIGNUP_WITH_REDIRECT: () => '/login?signup&from=' + encodeURIComponent(window.location.pathname),
  LOGIN_RESULT: '/login-result',
  FILES: '/files',
  FILES_SHARED_WITH_ME: '/files/shared-with-me',
  FILE: (uuid: string) => `/file/${uuid}`,
  FILE_CONNECTIONS: (uuid: string) => `/file/${uuid}/connections`,
  FILE_CONNECTIONS_CREATE: (uuid: string, type: string) => `/file/${uuid}/connections/create/${type}`,
  FILE_CONNECTION: (fileUuid: string, connectionUuid: string) => `/file/${fileUuid}/connections/${connectionUuid}`,
  CONNECTIONS: '/connections',
  CONNECTIONS_CREATE: '/connections/create',
  CONNECTIONS_CREATE_TYPE: (type: 'postgres' | 'etc') => `/connections/create/${type}`, // TODO: (connections)  Pull types from backend

  // API routes are client-side routes to use react-router's data APIs (e.g. fetchers)
  API_FILE: (uuid: string) => `/api/files/${uuid}`,
  API_FILE_SHARING: (uuid: string) => `/api/files/${uuid}/sharing`,
  // TODO: rename to FILE and the current FILE to FILE_IN_APP (or something?)
  FILES_FILE: (uuid: string) => `/files/${uuid}`,
  FILES_SHARE: (uuid: string) => `/files/${uuid}/sharing`,
  CREATE_FILE: '/files/create',
  CREATE_FILE_EXAMPLE: (publicFileUrlInProduction: string) => `/files/create?example=${publicFileUrlInProduction}`,
  CREATE_FILE_IN_TEAM: (teamUuid: string) => `/files/create?team-uuid=${teamUuid}`,
  TEAMS: `/teams`,
  TEAM: (uuid: string) => `/teams/${uuid}`,
  EDIT_TEAM: (uuid: string) => `/teams/${uuid}/edit`,
  EXAMPLES: '/examples',
  ACCOUNT: '/account',
  EDUCATION_ENROLL: '/education/enroll',
};

export const ROUTE_LOADER_IDS = {
  ROOT: 'root',
  FILE: 'file',
  FILE_METADATA: 'file-metadata',
  TEAM: 'team',
  DASHBOARD: 'dashboard',
};

export const SEARCH_PARAMS = {
  DIALOG: { KEY: 'dialog', VALUES: { EDUCATION: 'education', CREATE_TEAM: 'create-team' } },
  SNACKBAR_MSG: { KEY: 'snackbar-msg' }, // VALUE can be any message you want to display
  SNACKBAR_SEVERITY: { KEY: 'snackbar-severity', VALUE: { ERROR: 'error' } },
};
