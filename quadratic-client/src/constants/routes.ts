import { ExampleFileNames } from './appConstants';

// Any routes referenced outside of the root router are stored here
export const ROUTES = {
  LOGOUT: '/logout',
  LOGIN: '/login',
  LOGIN_WITH_REDIRECT: () => '/login?from=' + encodeURIComponent(window.location.pathname),
  SIGNUP_WITH_REDIRECT: () => '/login?signup&from=' + encodeURIComponent(window.location.pathname),
  LOGIN_RESULT: '/login-result',
  FILES: '/files',
  FILES_SHARED_WITH_ME: '/files/shared-with-me',
  // TODO: rename to FILE and the current FILE to FILE_IN_APP (or something?)
  FILES_FILE: (uuid: string) => `/files/${uuid}`,
  FILES_SHARE: (uuid: string) => `/files/${uuid}/sharing`,
  CREATE_FILE: '/files/create',
  TEAMS: `/teams`,
  TEAM: (uuid: string) => `/teams/${uuid}`,
  CREATE_TEAM: '/teams/create',
  EDIT_TEAM: (uuid: string) => `/teams/${uuid}/edit`,
  CREATE_EXAMPLE_FILE: (exampleFileName: ExampleFileNames) => `/files/create?example=${exampleFileName}`,
  EXAMPLES: '/examples',
  ACCOUNT: '/account',
  FILE: (uuid: string) => `/file/${uuid}`,
};

export const ROUTE_LOADER_IDS = {
  ROOT: 'root',
  FILE: 'file',
};
