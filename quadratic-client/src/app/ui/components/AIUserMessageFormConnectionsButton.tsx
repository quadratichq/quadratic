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
  disabled?: boolean;
  context: Context;
  setContext?: React.Dispatch<React.SetStateAction<Context>>;
  textareaRef?: React.RefObject<HTMLTextAreaElement | null>;
  variant?: 'default' | 'empty-state';
}
export const AIUserMessageFormConnectionsButton = memo(
  ({
    disabled = false,
    context,
    setContext,
    textareaRef,
    variant = 'default',
  }: AIUserMessageFormConnectionsButtonProps) => {
    const { connections } = useConnectionsFetcher();
    const setAIAnalystActiveSchemaConnectionUuid = useSetRecoilState(aiAnalystActiveSchemaConnectionUuidAtom);

    const handleOnClickButton = useCallback(() => {
      trackEvent('[AIConnectionsPicker].show');
    }, []);

    const handleAutoClose = useCallback(
      (e: Event) => {
        if (textareaRef?.current) {
          e.preventDefault();
          textareaRef.current.focus();
        }
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

    const triggerButton =
      variant === 'empty-state' ? (
        <DropdownMenuTrigger asChild>
          <button
            className="flex h-10 items-center gap-2 rounded-lg border border-border bg-background px-3 transition-all hover:bg-accent"
            disabled={disabled}
            onClick={handleOnClickButton}
          >
            <span className="flex h-5 w-5 shrink-0 items-center justify-center leading-none">
              <DatabaseIcon className="!text-muted-foreground" />
            </span>
            <span className="text-sm">Connections</span>
          </button>
        </DropdownMenuTrigger>
      ) : (
        <TooltipPopover label="Chat with a connected data source" fastMode={true}>
          <DropdownMenuTrigger asChild>
            <Button
              size="sm"
              className="h-7 w-7 gap-1.5 rounded-full px-0 shadow-none hover:bg-border @[450px]:w-auto @[450px]:px-2"
              variant="ghost"
              disabled={disabled}
              onClick={handleOnClickButton}
            >
              <DatabaseIcon className="" />
              <span className="hidden text-xs @[450px]:inline">Connections</span>
            </Button>
          </DropdownMenuTrigger>
        </TooltipPopover>
      );

    return (
      <DropdownMenu>
        {triggerButton}

        <DropdownMenuContent
          side={variant === 'empty-state' ? 'bottom' : 'top'}
          align="start"
          onCloseAutoFocus={handleAutoClose}
          className="min-w-48 max-w-xs"
        >
          <DropdownMenuLabel className="text-xs font-semibold text-muted-foreground">Connections</DropdownMenuLabel>
          <DropdownMenuItem onClick={handleManageConnections} className="gap-4">
            <SettingsIcon className="flex-shrink-0 text-muted-foreground" />
            <span className="truncate">Add or manage connections</span>
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
