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
import { trackEvent } from '@/shared/utils/analyticsEvents';
import { useSetRecoilState } from 'recoil';

export function AIUserMessageFormConnectionsButton({
  disabled,
  selectedConnectionUuid,
  setSelectedConnectionUuid,
  textareaRef,
}: {
  disabled: boolean;
  selectedConnectionUuid: string;
  setSelectedConnectionUuid: (connectionUuid: string) => void;
  textareaRef: React.RefObject<HTMLTextAreaElement | null>;
}) {
  const setShowConnectionsMenu = useSetRecoilState(editorInteractionStateShowConnectionsMenuAtom);
  const { connections } = useConnectionsFetcher();

  return (
    <DropdownMenu>
      <TooltipPopover label="Add a connection">
        <DropdownMenuTrigger asChild>
          <Button
            size="icon-sm"
            className="h-7 w-7 rounded-full px-0 shadow-none hover:bg-border"
            variant="ghost"
            disabled={disabled}
            onClick={() => {
              trackEvent('[AIConnectionsPicker].show');
            }}
          >
            <DatabaseIcon className="" />
          </Button>
        </DropdownMenuTrigger>
      </TooltipPopover>

      <DropdownMenuContent
        side="top"
        align="start"
        onCloseAutoFocus={(e) => {
          e.preventDefault();
          textareaRef.current?.focus();
        }}
        className="max-w-xs"
      >
        <DropdownMenuItem
          onClick={() => {
            trackEvent('[AIConnectionsPicker].manageConnections');
            setShowConnectionsMenu(true);
          }}
          className="pl-8"
        >
          Manage…
        </DropdownMenuItem>

        {connections.length > 0 && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuRadioGroup
              value={selectedConnectionUuid}
              onValueChange={(connectionUuid) => {
                if (selectedConnectionUuid === connectionUuid) {
                  trackEvent('[AIConnectionsPicker].unselectConnection');
                  setSelectedConnectionUuid('');
                } else {
                  trackEvent('[AIConnectionsPicker].selectConnection');
                  setSelectedConnectionUuid(connectionUuid);
                }
              }}
            >
              {connections.map((connection) => (
                <DropdownMenuRadioItem value={connection.uuid} key={connection.uuid} className="gap-4">
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
