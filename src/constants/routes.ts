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

  // API routes are client-side routes to use react-router's data APIs (e.g. fetchers)
  API_FILE: (uuid: string) => `/api/files/${uuid}`,
  // TODO rename to /api/files
  API_FILE_SHARING: (uuid: string) => `/api/file/${uuid}/sharing`,
};

export const ROUTE_LOADER_IDS = {
  ROOT: 'root',
  FILE: 'file',
};
