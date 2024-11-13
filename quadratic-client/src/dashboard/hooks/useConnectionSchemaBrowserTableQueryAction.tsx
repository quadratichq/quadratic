import { useSaveAndRunCell } from '@/app/ui/menus/CodeEditor/hooks/useSaveAndRunCell';
import { newNewFileFromStateConnection } from '@/shared/hooks/useNewFileFromState';
import { Button } from '@/shared/shadcn/ui/button';
import mixpanel from 'mixpanel-browser';
import * as monaco from 'monaco-editor';
import { ConnectionType } from 'quadratic-shared/typesAndSchemasConnections';
import { Link } from 'react-router-dom';

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
      const to = newNewFileFromStateConnection({ query, isPrivate, teamUuid, connectionType, connectionUuid });
      return (
        <Link
          to={to}
          reloadDocument
          onClick={() => {
            mixpanel.track('[Connections].schemaViewer.newFileFromTable');
          }}
        >
          <Button size="sm" variant="secondary" disabled={to.length === 0}>
            New file querying selected table
          </Button>
        </Link>
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
            mixpanel.track('[Connections].schemaViewer.insertQuery');

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
