import type { CodeCellLanguage } from '@/app/quadratic-core-types';
import { SNIPPET_PY_API } from '@/app/ui/menus/CodeEditor/snippetsPY';
import { ROUTES } from '@/shared/constants/routes';
import type { ConnectionType } from 'quadratic-shared/typesAndSchemasConnections';

/**
 * @returns {string} A `to` link for use with a `Link` component
 */
export const useNewFileFromStatePythonApi = ({ isPrivate, teamUuid }: { isPrivate: boolean; teamUuid: string }) => {
  const stateUrlParam = {
    codeString: SNIPPET_PY_API,
    language: 'Python' as CodeCellLanguage,
  };

  const to = ROUTES.CREATE_FILE(teamUuid, { state: stateUrlParam, private: isPrivate });

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
  prompt,
}: {
  isPrivate: boolean;
  teamUuid: string;
  query: string;
  connectionType: ConnectionType;
  connectionUuid: string;
  prompt?: string;
}) => {
  const stateUrlParam = {
    codeString: query,
    language: { Connection: { kind: connectionType, id: connectionUuid } },
  };

  const to = ROUTES.CREATE_FILE(teamUuid, { state: stateUrlParam, private: isPrivate, prompt });

  return to;
};
