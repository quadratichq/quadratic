import { activeSchemaConnectionUuidAtom } from '@/app/ai/atoms/aiAnalystAtoms';
import {
  editorInteractionStateShowConnectionsMenuAtom,
  editorInteractionStateTeamUuidAtom,
} from '@/app/atoms/editorInteractionStateAtom';
import { useConnectionsFetcher } from '@/app/ui/hooks/useConnectionsFetcher';
import { apiClient } from '@/shared/api/apiClient';
import { CheckIcon, DatabaseIcon, SettingsIcon } from '@/shared/components/Icons';
import { LanguageIcon } from '@/shared/components/LanguageIcon';
import { Button } from '@/shared/shadcn/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/shared/shadcn/ui/dropdown-menu';
import { TooltipPopover } from '@/shared/shadcn/ui/tooltip';
import { cn } from '@/shared/shadcn/utils';
import { trackEvent } from '@/shared/utils/analyticsEvents';
import * as Sentry from '@sentry/react';
import { useSetAtom } from 'jotai';
import type { Context } from 'quadratic-shared/typesAndSchemasAI';
import type { ConnectionList } from 'quadratic-shared/typesAndSchemasConnections';
import { memo, useCallback, useEffect, useState } from 'react';
import { useRecoilCallback, useRecoilValue } from 'recoil';

const SYNCED_CONNECTION_POLL_INTERVAL_MS = 10000; // 10 seconds

interface ConnectionMenuItemProps {
  connection: ConnectionList[number];
  teamUuid: string;
  isActive: boolean;
  onClick: () => void;
}

const ConnectionMenuItem = memo(({ connection, teamUuid, isActive, onClick }: ConnectionMenuItemProps) => {
  const [percentCompleted, setPercentCompleted] = useState<number | undefined>(
    connection.syncedConnectionPercentCompleted
  );

  // Poll for updated syncedConnectionPercentCompleted when the connection has sync data
  useEffect(() => {
    // Only poll if this is a synced connection
    if (connection.syncedConnectionUpdatedDate === undefined) {
      return;
    }

    const fetchConnection = async () => {
      try {
        const fetchedConnection = await apiClient.connections.get({
          connectionUuid: connection.uuid,
          teamUuid,
        });
        setPercentCompleted(fetchedConnection?.syncedConnectionPercentCompleted);
      } catch {
        // Silently fail - keep using existing percentCompleted value
      }
    };

    // Fire immediately to get fresh data
    fetchConnection();

    // Then poll every interval
    const interval = setInterval(fetchConnection, SYNCED_CONNECTION_POLL_INTERVAL_MS);

    return () => clearInterval(interval);
  }, [connection.uuid, connection.syncedConnectionUpdatedDate, teamUuid]);

  const isSyncedConnection = connection.syncedConnectionUpdatedDate !== undefined;
  const isDisabled = isSyncedConnection && percentCompleted !== undefined && percentCompleted < 100;

  return (
    <DropdownMenuItem key={connection.uuid} onClick={onClick} className="gap-4" disabled={isDisabled}>
      <LanguageIcon language={connection.type} className="flex-shrink-0" />
      <span className="truncate">{connection.name}</span>
      {isDisabled && <time className="ml-2 text-xs text-muted-foreground">(syncing, {percentCompleted}%)</time>}
      <CheckIcon className={cn('ml-auto flex-shrink-0', isActive ? 'visible' : 'invisible opacity-0')} />
    </DropdownMenuItem>
  );
});

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
    const setAIAnalystActiveSchemaConnectionUuid = useSetAtom(activeSchemaConnectionUuidAtom);

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

    const handleManageConnections = useRecoilCallback(
      ({ set }) =>
        () => {
          trackEvent('[AIConnectionsPicker].manageConnections');
          set(editorInteractionStateShowConnectionsMenuAtom, true);
        },
      []
    );

    const handleClickConnection = useCallback(
      (connectionUuid: string) => {
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
        trackEvent('[AIConnectionsPicker].selectConnection');
        const connection = connections.find((connection) => connection.uuid === connectionUuid);
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
          <DropdownMenuLabel className="text-xs font-semibold text-muted-foreground">Connections</DropdownMenuLabel>
          <DropdownMenuItem onClick={handleManageConnections} className="gap-4">
            <SettingsIcon className="flex-shrink-0 text-muted-foreground" />
            <span className="truncate">Add or manage connections</span>
          </DropdownMenuItem>

          {connections.length > 0 && (
            <>
              <DropdownMenuSeparator />

              {connections.map((connection) => (
                <ConnectionMenuItem
                  key={connection.uuid}
                  connection={connection}
                  teamUuid={teamUuid}
                  isActive={context.connection?.id === connection.uuid}
                  onClick={() => handleClickConnection(connection.uuid)}
                />
              ))}
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
    );
  }
);
