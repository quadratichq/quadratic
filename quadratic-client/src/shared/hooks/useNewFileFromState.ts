import { CodeCellLanguage } from '@/app/quadratic-core-types';
import { SNIPPET_PY_API } from '@/app/ui/menus/CodeEditor/snippetsPY';
import { ROUTES } from '@/shared/constants/routes';
import { ConnectionType } from 'quadratic-shared/typesAndSchemasConnections';

/**
 * @returns {string} A `to` link for use with a `Link` component
 */
export const useNewFileFromStatePythonApi = ({ isPrivate, teamUuid }: { isPrivate: boolean; teamUuid: string }) => {
  const stateUrlParam = {
    codeString: SNIPPET_PY_API,
    language: 'Python' as CodeCellLanguage,
  };

  const to = isPrivate
    ? ROUTES.CREATE_FILE_PRIVATE(teamUuid, stateUrlParam)
    : ROUTES.CREATE_FILE(teamUuid, stateUrlParam);

  return to;
};

/**
 * @returns {string} A `to` link for use with a `Link` component
 */
export const newNewFileFromStateConnection = ({
  isPrivate,
  teamUuid,
  query,
  connectionType,
  connectionUuid,
}: {
  isPrivate: boolean;
  teamUuid: string;
  query: string;
  connectionType: ConnectionType;
  connectionUuid: string;
}) => {
  const stateUrlParam = {
    codeString: query,
    language: { Connection: { kind: connectionType, id: connectionUuid } },
  };

  const to = isPrivate
    ? ROUTES.CREATE_FILE_PRIVATE(teamUuid, stateUrlParam)
    : ROUTES.CREATE_FILE(teamUuid, stateUrlParam);

  return to;
};
