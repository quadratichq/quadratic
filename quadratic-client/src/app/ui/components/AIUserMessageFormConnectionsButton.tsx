import { editorInteractionStateShowConnectionsMenuAtom } from '@/app/atoms/editorInteractionStateAtom';
import { sheets } from '@/app/grid/controller/Sheets';
import { useConnectionsFetcher } from '@/app/ui/hooks/useConnectionsFetcher';
import { useSubmitAIAnalystPrompt } from '@/app/ui/menus/AIAnalyst/hooks/useSubmitAIAnalystPrompt';
import { DatabaseIcon, SettingsIcon } from '@/shared/components/Icons';
import { LanguageIcon } from '@/shared/components/LanguageIcon';
import { Button } from '@/shared/shadcn/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/shared/shadcn/ui/dropdown-menu';
import { TooltipPopover } from '@/shared/shadcn/ui/tooltip';
import { trackEvent } from '@/shared/utils/analyticsEvents';
import { createTextContent } from 'quadratic-shared/ai/helpers/message.helper';
import { useSetRecoilState } from 'recoil';

export function AIUserMessageFormConnectionsButton({ disabled }: { disabled: boolean }) {
  const setShowConnectionsMenu = useSetRecoilState(editorInteractionStateShowConnectionsMenuAtom);
  const { connections } = useConnectionsFetcher();
  const { submitPrompt } = useSubmitAIAnalystPrompt();

  return (
    <DropdownMenu>
      <TooltipPopover label="Add a connection">
        <DropdownMenuTrigger asChild>
          <Button
            size="icon-sm"
            className="h-7 w-7 rounded-full px-0 shadow-none hover:bg-border"
            variant="ghost"
            disabled={disabled}
          >
            <DatabaseIcon className="" />
          </Button>
        </DropdownMenuTrigger>
      </TooltipPopover>

      <DropdownMenuContent side="top" align="start">
        <DropdownMenuItem
          onClick={() => {
            // TODO: event tracking for this feature
            trackEvent('[AIUserMessageFormConnectionsButton].manageConnections');
            setShowConnectionsMenu(true);
          }}
        >
          <SettingsIcon className="mr-2 text-muted-foreground" />
          Add / manage connections
        </DropdownMenuItem>
        {connections.length > 0 && <DropdownMenuSeparator />}
        {connections.map((connection) => (
          <DropdownMenuItem
            key={connection.uuid}
            onClick={() => {
              // TODO: add event tracking
              // trackEvent('[AIUserMessageFormConnectionsButton].chatWithConnection', { connectionName: connection.name });
              // TODO: add as context to the prompt?
              submitPrompt({
                messageSource: 'ConnectionsPicker',
                content: [
                  createTextContent(
                    `For the connection ${connection.name}, help me understand what is in this data source and what I can do with it. If there is no data on the sheet add sample data and plot it.`
                  ),
                ],
                context: {
                  sheets: [],
                  currentSheet: sheets.sheet.name,
                  selection: undefined,
                  connections: [{ type: connection.type, uuid: connection.uuid, name: connection.name }],
                },
                messageIndex: 0,
              });
            }}
          >
            <LanguageIcon language={connection.type} className="mr-2" />
            {connection.name}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
