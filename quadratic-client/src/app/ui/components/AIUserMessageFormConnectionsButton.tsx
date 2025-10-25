import { aiAnalystActiveSchemaConnectionUuidAtom } from '@/app/atoms/aiAnalystAtom';
import { editorInteractionStateShowConnectionsMenuAtom } from '@/app/atoms/editorInteractionStateAtom';
import { useConnectionsFetcher } from '@/app/ui/hooks/useConnectionsFetcher';
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
import type { Context } from 'quadratic-shared/typesAndSchemasAI';
import { memo, useCallback } from 'react';
import { useRecoilCallback, useSetRecoilState } from 'recoil';

interface AIUserMessageFormConnectionsButtonProps {
  disabled: boolean;
  context: Context;
  setContext?: React.Dispatch<React.SetStateAction<Context>>;
  textareaRef: React.RefObject<HTMLTextAreaElement | null>;
}
export const AIUserMessageFormConnectionsButton = memo(
  ({ disabled, context, setContext, textareaRef }: AIUserMessageFormConnectionsButtonProps) => {
    const { connections } = useConnectionsFetcher();
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
        <TooltipPopover label="Add a connection">
          <DropdownMenuTrigger asChild>
            <Button
              size="icon-sm"
              className="h-7 w-7 rounded-full px-0 shadow-none hover:bg-border"
              variant="ghost"
              disabled={disabled}
              onClick={handleOnClickButton}
            >
              <DatabaseIcon className="" />
            </Button>
          </DropdownMenuTrigger>
        </TooltipPopover>

        <DropdownMenuContent side="top" align="start" onCloseAutoFocus={handleAutoClose} className="min-w-48 max-w-xs">
          <DropdownMenuLabel className="text-xs font-semibold text-muted-foreground">Connections</DropdownMenuLabel>
          <DropdownMenuItem onClick={handleManageConnections} className="gap-4">
            <SettingsIcon className="flex-shrink-0 text-muted-foreground" />
            <span className="truncate">Add or manage…</span>
          </DropdownMenuItem>

          {connections.length > 0 && (
            <>
              <DropdownMenuSeparator />

              {connections.map((connection) => {
                const isActive = context.connection?.id === connection.uuid;
                return (
                  <DropdownMenuItem
                    key={connection.uuid}
                    onClick={() => handleClickConnection(connection.uuid)}
                    className={`gap-4`}
                  >
                    <LanguageIcon language={connection.type} className="flex-shrink-0" />
                    <span className="truncate">{connection.name}</span>
                    <CheckIcon className={cn('ml-auto flex-shrink-0', isActive ? 'visible' : 'invisible opacity-0')} />
                  </DropdownMenuItem>
                );
              })}
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
    );
  }
);
