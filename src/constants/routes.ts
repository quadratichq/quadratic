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
  TEAMS: '/teams',
  ACCOUNT: '/account',
  FILE: (uuid: string) => `/file/${uuid}`,
  CONNECTIONS: '/connections',
  CONNECTIONS_CREATE: '/connections/create',
  CONNECTIONS_CREATE_TYPE: (type: 'postgres' | 'etc') => `/connections/create/${type}`, // TODO: Pull types from backend
};

export const ROUTE_LOADER_IDS = {
  ROOT: 'root',
  FILE: 'file',
};
