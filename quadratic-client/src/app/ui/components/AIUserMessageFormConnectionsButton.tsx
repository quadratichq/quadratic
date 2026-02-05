import { aiAnalystActiveSchemaConnectionUuidAtom } from '@/app/atoms/aiAnalystAtom';
import {
  editorInteractionStateShowConnectionsMenuAtom,
  editorInteractionStateTeamUuidAtom,
} from '@/app/atoms/editorInteractionStateAtom';
import { useConnectionsFetcher } from '@/app/ui/hooks/useConnectionsFetcher';
import { ConnectionsMenuContent } from '@/shared/components/connections/ConnectionsMenuContent';
import { DatabaseIcon } from '@/shared/components/Icons';
import { Button } from '@/shared/shadcn/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuTrigger } from '@/shared/shadcn/ui/dropdown-menu';
import { TooltipPopover } from '@/shared/shadcn/ui/tooltip';
import { trackEvent } from '@/shared/utils/analyticsEvents';
import * as Sentry from '@sentry/react';
import type { Context } from 'quadratic-shared/typesAndSchemasAI';
import type { ConnectionType } from 'quadratic-shared/typesAndSchemasConnections';
import { memo, useCallback } from 'react';
import { useRecoilCallback, useRecoilValue, useSetRecoilState } from 'recoil';

interface AIUserMessageFormConnectionsButtonProps {
  disabled: boolean;
  context: Context;
  setContext?: React.Dispatch<React.SetStateAction<Context>>;
  textareaRef: React.RefObject<HTMLTextAreaElement | null>;
}
export const AIUserMessageFormConnectionsButton = memo(
  ({ disabled, context, setContext, textareaRef }: AIUserMessageFormConnectionsButtonProps) => {
    const { connections } = useConnectionsFetcher();
    const teamUuid = useRecoilValue(editorInteractionStateTeamUuidAtom);
    const setAIAnalystActiveSchemaConnectionUuid = useSetRecoilState(aiAnalystActiveSchemaConnectionUuidAtom);

    const handleOnClickButton = useCallback(() => {
      trackEvent('[AIConnectionsPicker].show');
    }, []);

    const handleAutoClose = useCallback(
      (e: Event) => {
        e.preventDefault();
        textareaRef.current?.focus();
      },
      [textareaRef]
    );

    const handleAddConnection = useRecoilCallback(
      ({ set }) =>
        (type: ConnectionType) => {
          trackEvent('[AIConnectionsPicker].addConnection', { type });
        },
      []
    );

    const handleManageConnections = useRecoilCallback(
      ({ set }) =>
        () => {
          trackEvent('[AIConnectionsPicker].manageConnections');
          set(editorInteractionStateShowConnectionsMenuAtom, true);
        },
      []
    );

    const handleSelectConnection = useCallback(
      (connectionUuid: string, connectionType: ConnectionType, connectionName: string) => {
        // If it's the same connection, unselect it
        if (context.connection?.id === connectionUuid) {
          trackEvent('[AIConnectionsPicker].unselectConnection');
          setContext?.((prev) => ({
            ...prev,
            connection: undefined,
          }));
          setAIAnalystActiveSchemaConnectionUuid(undefined);
          return;
        }

        // Otherwise set it as the newly selected connection
        const connection = connections.find((connection) => connection.uuid === connectionUuid);
        trackEvent('[AIConnectionsPicker].selectConnection', { language: connection?.type });
        if (connection === undefined) {
          Sentry.captureException(new Error('A connection that was picked in the UI is not stored in local state.'));
          return;
        }
        setContext?.((prev) => ({
          ...prev,
          connection: { type: connection.type, id: connection.uuid, name: connection.name },
        }));
        setAIAnalystActiveSchemaConnectionUuid(connectionUuid);
      },
      [connections, context.connection, setContext, setAIAnalystActiveSchemaConnectionUuid]
    );

    return (
      <DropdownMenu>
        <TooltipPopover label="Chat with a connected data source" fastMode={true}>
          <DropdownMenuTrigger asChild>
            <Button
              size="icon-sm"
              className="h-7 w-7 rounded-full px-0 shadow-none hover:bg-border"
              variant="ghost"
              disabled={disabled}
              onClick={handleOnClickButton}
            >
              <DatabaseIcon />
            </Button>
          </DropdownMenuTrigger>
        </TooltipPopover>

        <DropdownMenuContent side="top" align="start" onCloseAutoFocus={handleAutoClose} className="min-w-48 max-w-xs">
          <ConnectionsMenuContent
            connections={connections}
            teamUuid={teamUuid}
            activeConnectionId={context.connection?.id}
            actionsFirst
            onSelectConnection={handleSelectConnection}
            onAddConnection={handleAddConnection}
            onManageConnections={handleManageConnections}
          />
        </DropdownMenuContent>
      </DropdownMenu>
    );
  }
);
