import { ExampleFileNames } from './appConstants';

// Any routes referenced outside of the root router are stored here
export const ROUTES = {
  LOGOUT: '/logout',
  LOGIN: '/login',
  LOGIN_WITH_REDIRECT: () => '/login?from=' + encodeURIComponent(window.location.pathname),
  SIGNUP_WITH_REDIRECT: () => '/login?signup&from=' + encodeURIComponent(window.location.pathname),
  LOGIN_RESULT: '/login-result',
  FILES: '/files',
  CREATE_FILE: '/files/create',
  CREATE_EXAMPLE_FILE: (exampleFileName: ExampleFileNames) => `/files/create?example=${exampleFileName}`,
  EXAMPLES: '/examples',
  TEAMS: '/teams',
  ACCOUNT: '/account',
  FILE: (uuid: string) => `/file/${uuid}`,

  // API routes are client-side routes to use react-router's data APIs (e.g. fetchers)
  API_FILE: (uuid: string) => `/api/files/${uuid}`,
  API_FILE_SHARING: (uuid: string) => `/api/files/${uuid}/sharing`,
};

export const ROUTE_LOADER_IDS = {
  ROOT: 'root',
  FILE: 'file',
};
