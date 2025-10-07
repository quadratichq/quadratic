import { aiAnalystAtom } from '@/app/atoms/aiAnalystAtom';
import { editorInteractionStateShowConnectionsMenuAtom } from '@/app/atoms/editorInteractionStateAtom';
import { useConnectionsFetcher } from '@/app/ui/hooks/useConnectionsFetcher';
import { DatabaseIcon } from '@/shared/components/Icons';
import { LanguageIcon } from '@/shared/components/LanguageIcon';
import { Button } from '@/shared/shadcn/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/shared/shadcn/ui/dropdown-menu';
import { TooltipPopover } from '@/shared/shadcn/ui/tooltip';
import { cn } from '@/shared/shadcn/utils';
import { trackEvent } from '@/shared/utils/analyticsEvents';
import type { Context } from 'quadratic-shared/typesAndSchemasAI';
import { memo, useCallback } from 'react';
import { useRecoilCallback, useRecoilState } from 'recoil';

interface AIUserMessageFormConnectionsButtonProps {
  disabled: boolean;
  context: Context;
  setContext?: React.Dispatch<React.SetStateAction<Context>>;
  textareaRef: React.RefObject<HTMLTextAreaElement | null>;
}
export const AIUserMessageFormConnectionsButton = memo(
  ({ disabled, context, setContext, textareaRef }: AIUserMessageFormConnectionsButtonProps) => {
    const { connections } = useConnectionsFetcher();
    const [aiAnalyst, setAIAnalyst] = useRecoilState(aiAnalystAtom);

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
        if (context.connection?.id === connectionUuid) {
          trackEvent('[AIConnectionsPicker].unselectConnection');
          setContext?.((prev) => ({
            ...prev,
            connection: undefined,
          }));
          setAIAnalyst((prev) => ({ ...prev, contextConnectionUuid: undefined }));
        } else {
          trackEvent('[AIConnectionsPicker].selectConnection');
          const connection = connections.find((connection) => connection.uuid === connectionUuid);
          setContext?.((prev) => ({
            ...prev,
            connection: connection ? { type: connection.type, id: connection.uuid, name: connection.name } : undefined,
          }));
          setAIAnalyst((prev) => ({ ...prev, contextConnectionUuid: connectionUuid }));
        }
      },
      [connections, context.connection, setContext, setAIAnalyst]
    );

    console.log(
      aiAnalyst.contextConnectionUuid,
      connections.map((connection) => connection.uuid)
    );

    return (
      <DropdownMenu>
        <TooltipPopover label="Add a connection">
          <DropdownMenuTrigger asChild>
            <Button
              size="icon-sm"
              className={cn('h-7 w-7 rounded-full px-0 shadow-none hover:bg-border')}
              variant="ghost"
              disabled={disabled}
              onClick={handleOnClickButton}
            >
              <DatabaseIcon className="" />
            </Button>
          </DropdownMenuTrigger>
        </TooltipPopover>

        <DropdownMenuContent side="top" align="start" onCloseAutoFocus={handleAutoClose} className="max-w-xs">
          <DropdownMenuItem onClick={handleManageConnections} className="pl-8">
            Manage…
          </DropdownMenuItem>

          {connections.length > 0 && (
            <>
              <DropdownMenuSeparator />

              <DropdownMenuRadioGroup value={context.connection?.id ?? ''} onValueChange={handleClickConnection}>
                {connections.map((connection) => (
                  <DropdownMenuRadioItem key={connection.uuid} value={connection.uuid} className="gap-4">
                    <span className="truncate">{connection.name}</span>
                    <LanguageIcon language={connection.type} className="ml-auto flex-shrink-0" />
                  </DropdownMenuRadioItem>
                ))}
              </DropdownMenuRadioGroup>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
    );
  }
);
