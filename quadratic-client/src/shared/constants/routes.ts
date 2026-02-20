import type { UrlParamsDevState } from '@/app/gridGL/pixiApp/urlParams/UrlParamsDev';
import type { UserFilesListType } from '@/dashboard/atoms/userFilesListFiltersAtom';
import type { ConnectionType } from 'quadratic-shared/typesAndSchemasConnections';

// Any routes referenced outside of the root router are stored here
export const ROUTES = {
  LOGOUT: '/logout',
  LOGIN: '/login',
  LOGIN_WITH_REDIRECT: (href?: string) =>
    `/login?${SEARCH_PARAMS.REDIRECT_TO.KEY}=${encodeURIComponent(href ?? window.location.pathname)}`,
  LOGIN_RESULT: '/login-result',
  SIGNUP: '/signup',
  SIGNUP_WITH_REDIRECT: (href?: string) =>
    `/login?type=signup&${SEARCH_PARAMS.REDIRECT_TO.KEY}=${encodeURIComponent(href ?? window.location.pathname)}`,
  VERIFY_EMAIL: '/verify-email',
  SEND_RESET_PASSWORD: '/send-reset-password',
  RESET_PASSWORD: '/reset-password',
  FILE: ({ uuid, searchParams }: { uuid: string; searchParams?: string }) =>
    `/file/${uuid}${searchParams ? `?${searchParams}` : ''}`,
  FILE_DUPLICATE: (uuid: string) => `/file/${uuid}/duplicate`,
  FILE_HISTORY: (uuid: string) => `/file/${uuid}/history`,
  EMBED: ({
    embedId,
    importUrl,
    readonly,
    sheet,
    preload,
  }: {
    embedId?: string;
    importUrl?: string;
    readonly?: boolean;
    sheet?: string;
    preload?: ('python' | 'js')[];
  }) => {
    const params = new URLSearchParams();
    if (embedId) params.set('embedId', embedId);
    if (importUrl) params.set('import', importUrl);
    if (readonly) params.set('readonly', '');
    if (sheet?.trim()) params.set('sheet', sheet.trim());
    if (preload?.length) params.set('preload', preload.join(','));
    return `/embed?${params.toString()}`;
  },
  EMBED_CLAIM: (token: string) => `/embed/claim/${token}`,
  FILES_CREATE: '/files/create',
  FILES_CREATE_AI: '/files/create/ai',
  // Team-based AI creation routes (these are the actual routes)
  TEAM_FILES_CREATE_AI: (teamUuid: string) => `/teams/${teamUuid}/files/create/ai`,
  TEAM_FILES_CREATE_AI_FILE: (teamUuid: string) => `/teams/${teamUuid}/files/create/ai/file`,
  TEAM_FILES_CREATE_AI_PROMPT: (teamUuid: string) => `/teams/${teamUuid}/files/create/ai/prompt`,
  TEAM_FILES_CREATE_AI_PDF: (teamUuid: string) => `/teams/${teamUuid}/files/create/ai/pdf`,
  TEAM_FILES_CREATE_AI_CONNECTION: (teamUuid: string) => `/teams/${teamUuid}/files/create/ai/connection`,
  TEAM_FILES_CREATE_AI_WEB: (teamUuid: string) => `/teams/${teamUuid}/files/create/ai/web`,
  CREATE_FILE: (
    teamUuid: string,
    searchParams: {
      state?: UrlParamsDevState['insertAndRunCodeInNewSheet'];
      prompt?: string | null;
      private?: boolean;
      chatId?: string | null;
      connectionUuid?: string | null;
      connectionType?: ConnectionType | null;
      connectionName?: string | null;
    } = {}
  ) => {
    let url = new URL(window.location.origin + `/teams/${teamUuid}/files/create`);

    if (searchParams.state) {
      url.searchParams.set('state', btoa(JSON.stringify({ insertAndRunCodeInNewSheet: searchParams.state })));
    }
    if (searchParams.prompt) {
      url.searchParams.set('prompt', searchParams.prompt);
    }
    if (searchParams.private) {
      url.searchParams.set('private', 'true');
    }
    if (searchParams.chatId) {
      url.searchParams.set('chat-id', searchParams.chatId);
    }
    if (searchParams.connectionUuid) {
      url.searchParams.set('connection-uuid', searchParams.connectionUuid);
    }
    if (searchParams.connectionType) {
      url.searchParams.set('connection-type', searchParams.connectionType);
    }
    if (searchParams.connectionName) {
      url.searchParams.set('connection-name', searchParams.connectionName);
    }

    return url.pathname + url.search;
  },
  CREATE_FILE_FROM_TEMPLATE: ({
    teamUuid,
    publicFileUrlInProduction,
    additionalParams,
  }: {
    teamUuid: string;
    publicFileUrlInProduction: string;
    additionalParams: string;
  }) =>
    `/teams/${teamUuid}/files/create?template=${publicFileUrlInProduction}&private${
      additionalParams ? `&${additionalParams}` : ''
    }`,
  TEAMS: `/teams`,
  TEAM: (teamUuid: string) => `/teams/${teamUuid}`,
  TEAM_BILLING_MANAGE: (teamUuid: string) => `/teams/${teamUuid}/billing/manage`,
  TEAM_BILLING_SUBSCRIBE: (teamUuid: string) => `/teams/${teamUuid}/billing/subscribe`,
  TEAM_CONNECTIONS: (teamUuid: string) => `/teams/${teamUuid}/connections`,
  TEAM_CONNECTIONS_NEW: (teamUuid: string) => `/teams/${teamUuid}/connections?view=new`,
  TEAM_CONNECTION_CREATE: (teamUuid: string, connectionType: ConnectionType) =>
    `/teams/${teamUuid}/connections?initial-connection-type=${connectionType}`,
  TEAM_CONNECTION: (teamUuid: string, connectionUuid: string, connectionType: ConnectionType) =>
    `/teams/${teamUuid}/connections?initial-connection-uuid=${connectionUuid}&initial-connection-type=${connectionType}`,
  TEAM_FILES: (teamUuid: string, { type }: { type?: UserFilesListType } = {}) =>
    `/teams/${teamUuid}/files${type ? `?type=${type}` : ''}`,
  TEAM_FILES_PRIVATE: (teamUuid: string) => ROUTES.TEAM_FILES(teamUuid, { type: 'private' }),
  TEAM_FILES_SHARED_WITH_ME: (teamUuid: string) => ROUTES.TEAM_FILES(teamUuid, { type: 'shared' }),
  TEAM_FILES_DELETED: (teamUuid: string) => `/teams/${teamUuid}/files/deleted`,
  TEAM_ONBOARDING: (teamUuid: string) => `/teams/${teamUuid}/onboarding`,
  TEAM_MEMBERS: (teamUuid: string) => `/teams/${teamUuid}/members`,
  TEAM_SETTINGS: (teamUuid: string) => `/teams/${teamUuid}/settings`,
  EDIT_TEAM: (teamUuid: string) => `/teams/${teamUuid}/edit`,
  ACTIVE_TEAM_SETTINGS: `/team/settings`,
  TEMPLATES: '/templates',
  LABS: '/labs',

  API: {
    FILE: (uuid: string) => `/api/files/${uuid}`,
    FILE_SHARING: (uuid: string) => `/api/files/${uuid}/sharing`,
    TEAM: (teamUuid: string) => `/api/teams/${teamUuid}`,
    CONNECTIONS: {
      POST: `/api/connections`,
      LIST: (teamUuid: string) => `/api/connections?team-uuid=${teamUuid}`,
      GET: ({ teamUuid, connectionUuid }: { teamUuid: string; connectionUuid: string }) =>
        `/api/connections?team-uuid=${teamUuid}&connection-uuid=${connectionUuid}`,
    },
  },

  IFRAME_INDEXEDDB: '/iframe-indexeddb',
} as const;

export const ROUTE_LOADER_IDS = {
  ROOT: 'root',
  FILE: 'file',
  EMBED: 'embed',
  DASHBOARD: 'dashboard',
} as const;

export const SEARCH_PARAMS = {
  SHEET: { KEY: 'sheet' },
  DIALOG: { KEY: 'dialog', VALUES: { EDUCATION: 'education' } },
  SNACKBAR_MSG: { KEY: 'snackbar-msg' }, // VALUE can be any message you want to display
  SNACKBAR_SEVERITY: { KEY: 'snackbar-severity', VALUE: { ERROR: 'error' } },
  // Used to load a specific checkpoint (version history), e.g. /file/123?sequence_num=456
  SEQUENCE_NUM: { KEY: 'sequence_num' },
  LOGIN_TYPE: { KEY: 'type', VALUES: { SIGNUP: 'signup' } },
  REDIRECT_TO: { KEY: 'redirectTo' },
  // Used to open the scheduled tasks panel when the file loads
  SCHEDULED_TASKS: { KEY: 'scheduled-tasks' },
} as const;
