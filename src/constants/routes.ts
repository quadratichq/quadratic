// Any routes referenced outside of the index Routes component are stored here
export const ROUTES = {
  LOGOUT: '/logout',
  LOGIN: '/login',
  LOGIN_RESULT: '/login-result',
  MY_FILES: '/files/mine',
  EXAMPLES: '/files/examples',
  CREATE_FILE: '/files/create',
  TEAMS: '/teams',
  ACCOUNT: '/account',
  FILE: (uuid: string) => `/file/${uuid}`,
};
