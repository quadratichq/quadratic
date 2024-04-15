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
  USER: '/user',
};

export const ROUTE_LOADER_IDS = {
  ROOT: 'root',
  FILE: 'file',
  TEAM: 'team',
  DASHBOARD: 'dashboard',
};
