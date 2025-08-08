import ConditionalWrapper from '@/app/ui/components/ConditionalWrapper';
import { useSaveAndRunCell } from '@/app/ui/menus/CodeEditor/hooks/useSaveAndRunCell';
import { newNewFileFromStateConnection } from '@/shared/hooks/useNewFileFromState';
import { Button } from '@/shared/shadcn/ui/button';
import { trackEvent } from '@/shared/utils/analyticsEvents';
import type * as monaco from 'monaco-editor';
import type { ConnectionType } from 'quadratic-shared/typesAndSchemasConnections';
import { Link } from 'react-router';

/**
 * This is only done on the dashboard-side, not the app-side
 */
export const useConnectionSchemaBrowserTableQueryActionNewFile = ({
  connectionType,
  connectionUuid,
  isPrivate,
  teamUuid,
}: {
  connectionType: ConnectionType;
  connectionUuid: string;
  isPrivate: boolean;
  teamUuid: string;
}) => {
  return {
    TableQueryAction: ({ query }: { query: string }) => {
      const isValidQuery = query.length > 0;
      const to = newNewFileFromStateConnection({ query, isPrivate, teamUuid, connectionType, connectionUuid });
      return (
        <ConditionalWrapper
          condition={isValidQuery}
          Wrapper={({ children }) => (
            <Link
              to={to}
              reloadDocument
              onClick={() => {
                trackEvent('[Connections].schemaViewer.newFileFromTable');
              }}
            >
              {children}
            </Link>
          )}
        >
          <Button size="sm" disabled={!isValidQuery}>
            New file with selected table
          </Button>
        </ConditionalWrapper>
      );
    },
  };
};

export const useConnectionSchemaBrowserTableQueryActionInsertQuery = ({
  editorInst,
}: {
  editorInst: monaco.editor.IStandaloneCodeEditor | null;
}) => {
  return {
    TableQueryAction: ({ query }: { query: string }) => {
      const { saveAndRunCell } = useSaveAndRunCell();
      return (
        <Button
          className="flex-shrink-0"
          variant="secondary"
          size="sm"
          disabled={query.length === 0}
          onClick={(e: React.MouseEvent<HTMLButtonElement>) => {
            trackEvent('[Connections].schemaViewer.insertQuery');

            if (editorInst) {
              const model = editorInst.getModel();
              if (!model) return;

              const range = model.getFullModelRange();
              editorInst.executeEdits('insert-query', [
                {
                  range,
                  text: query,
                },
              ]);

              editorInst.focus();
              saveAndRunCell();
            }
          }}
        >
          Query selected table
        </Button>
      );
    },
  };
};
