import { NewFileIcon } from '@/dashboard/components/CustomRadixIcons';
import { ROUTES } from '@/shared/constants/routes';
import { Button } from '@/shared/shadcn/ui/button';
import { TooltipPopover } from '@/shared/shadcn/ui/tooltip';
import { ClipboardCopyIcon } from '@radix-ui/react-icons';
import mixpanel from 'mixpanel-browser';
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
      const stateUrlParam = {
        codeString: query,
        language: { Connection: { kind: connectionType, id: connectionUuid } },
      };
      const to = isPrivate
        ? ROUTES.CREATE_FILE_PRIVATE(teamUuid, stateUrlParam)
        : ROUTES.CREATE_FILE(teamUuid, stateUrlParam);
      return (
        <TooltipPopover label="New file querying this table">
          <Button size="icon-sm" variant="ghost" asChild>
            <Link
              to={to}
              className="hover:bg-background"
              onClick={() => {
                mixpanel.track('[Connections].schemaViewer.newFileFromTable');
              }}
            >
              <NewFileIcon />
            </Link>
          </Button>
        </TooltipPopover>
      );
    },
  };
};

export const useConnectionSchemaBrowserTableQueryActionInsertQuery = ({ editorRef }: { editorRef: any }) => {
  return {
    TableQueryAction: ({ query }: { query: string }) => (
      <TooltipPopover label="Insert query">
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          onClick={(e: React.MouseEvent<HTMLButtonElement>) => {
            mixpanel.track('[Connections].schemaViewer.insertQuery');

            if (editorRef.current) {
              const model = editorRef.current.getModel();
              if (!model) return;

              const range = model.getFullModelRange();
              editorRef.current.executeEdits('insert-query', [
                {
                  range,
                  text: query,
                },
              ]);

              editorRef.current.focus();
            }
          }}
        >
          <ClipboardCopyIcon />
        </Button>
      </TooltipPopover>
    ),
  };
};
