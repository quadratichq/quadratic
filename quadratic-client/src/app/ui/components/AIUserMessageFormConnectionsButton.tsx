import { useConnectionsDropdownHandlers } from '@/app/ui/hooks/useConnectionsDropdownHandlers';
import { ConnectionsMenuContent } from '@/shared/components/connections/ConnectionsMenuContent';
import { DatabaseIcon } from '@/shared/components/Icons';
import { Button } from '@/shared/shadcn/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuTrigger } from '@/shared/shadcn/ui/dropdown-menu';
import { TooltipPopover } from '@/shared/shadcn/ui/tooltip';
import { trackEvent } from '@/shared/utils/analyticsEvents';
import { memo, useCallback } from 'react';

interface AIUserMessageFormConnectionsButtonProps {
  disabled: boolean;
  textareaRef: React.RefObject<HTMLTextAreaElement | null>;
}
export const AIUserMessageFormConnectionsButton = memo(
  ({ disabled, textareaRef }: AIUserMessageFormConnectionsButtonProps) => {
    const { connections, activeConnectionId, handleSelectConnection, handleAddConnection, handleManageConnections } =
      useConnectionsDropdownHandlers('AIConnectionsPicker');

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
            activeConnectionId={activeConnectionId}
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
