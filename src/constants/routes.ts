// Any routes referenced outside of the root router are stored here
export const ROUTES = {
  LOGOUT: '/logout',
  LOGIN: '/login',
  LOGIN_WITH_REDIRECT: () => '/login?from=' + encodeURIComponent(window.location.pathname),
  SIGNUP_WITH_REDIRECT: () => '/login?signup&from=' + encodeURIComponent(window.location.pathname),
  LOGIN_RESULT: '/login-result',
  FILES: '/files',
  MY_FILES: '/files/mine',
  EXAMPLES: '/files/examples',
  CREATE_FILE: '/files/create',
  TEAMS: `/teams`,
  TEAM: (uuid: string) => `/teams/${uuid}`,
  CREATE_TEAM: '/teams/create',
  ACCOUNT: '/account',
  FILE: (uuid: string) => `/file/${uuid}`,
};

export const ROUTE_LOADER_IDS = {
  ROOT: 'root',
  FILE: 'file',
};
