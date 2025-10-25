import { aiAnalystActiveSchemaConnectionUuidAtom, showAIAnalystAtom } from '@/app/atoms/aiAnalystAtom';
import { editorInteractionStateShowConnectionsMenuAtom } from '@/app/atoms/editorInteractionStateAtom';
import { events } from '@/app/events/events';
import { focusGrid } from '@/app/helpers/focusGrid';
import { useConnectionsFetcher } from '@/app/ui/hooks/useConnectionsFetcher';
import { SidebarToggle, SidebarTooltip } from '@/app/ui/QuadraticSidebar';
import { CheckIcon, SettingsIcon } from '@/shared/components/Icons';
import { LanguageIcon } from '@/shared/components/LanguageIcon';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/shared/shadcn/ui/dropdown-menu';
import { cn } from '@/shared/shadcn/utils';
import { trackEvent } from '@/shared/utils/analyticsEvents';
import { useCallback } from 'react';
import { useRecoilCallback, useRecoilState } from 'recoil';

// Update the ConnectionsMenu component to accept a custom trigger
export const ConnectionsMenu = ({ triggerIcon }: { triggerIcon: React.ReactNode }) => {
  const { connections } = useConnectionsFetcher();
  const [showAIAnalyst, setShowAIAnalyst] = useRecoilState(showAIAnalystAtom);
  const [aiAnalystActiveSchemaConnectionUuid, setAIAnalystActiveSchemaConnectionUuid] = useRecoilState(
    aiAnalystActiveSchemaConnectionUuidAtom
  );

  const handleOnClickButton = useCallback(() => {
    trackEvent('[ConnectionsMenu].show');
  }, []);

  const handleAutoClose = useCallback((e: Event) => {
    e.preventDefault();
    focusGrid();
  }, []);

  const handleManageConnections = useRecoilCallback(
    ({ set }) =>
      () => {
        trackEvent('[ConnectionsMenu].manageConnections');
        set(editorInteractionStateShowConnectionsMenuAtom, true);
      },
    []
  );

  return (
    <DropdownMenu>
      <SidebarTooltip label="Connections">
        <DropdownMenuTrigger asChild>
          <SidebarToggle onClick={handleOnClickButton}>{triggerIcon}</SidebarToggle>
        </DropdownMenuTrigger>
      </SidebarTooltip>
      <DropdownMenuContent
        side="right"
        align="start"
        alignOffset={-16}
        onCloseAutoFocus={handleAutoClose}
        className="min-w-48 max-w-xs"
      >
        <DropdownMenuLabel className="text-xs font-semibold text-muted-foreground">Connections</DropdownMenuLabel>
        <DropdownMenuItem onClick={handleManageConnections} className="gap-4">
          <SettingsIcon className="flex-shrink-0 text-muted-foreground" />
          <span className="truncate">Add or manage…</span>
        </DropdownMenuItem>

        {connections.length > 0 && (
          <>
            <DropdownMenuSeparator />

            {connections.map((connection) => {
              return (
                <DropdownMenuItem
                  key={connection.uuid}
                  className="gap-4"
                  onClick={() => {
                    // TODO: maybe if you trigger `setAIAnalystActiveSchemaConnectionUuid`,
                    // just automatically do all this other stuff
                    if (showAIAnalyst) {
                      setAIAnalystActiveSchemaConnectionUuid(connection.uuid);
                      events.emit('aiAnalystSetConnection', connection.uuid);
                      return;
                    }

                    setShowAIAnalyst(true);
                    setAIAnalystActiveSchemaConnectionUuid(connection.uuid);

                    const handleAIAnalystReady = () => {
                      setShowAIAnalyst(true);
                      setAIAnalystActiveSchemaConnectionUuid(connection.uuid);
                      setTimeout(() => {
                        events.emit('aiAnalystSetConnection', connection.uuid);
                        events.off('aiAnalystReady', handleAIAnalystReady);
                      }, 100);
                    };
                    events.on('aiAnalystReady', handleAIAnalystReady);
                  }}
                >
                  <LanguageIcon language={connection.type} className="flex-shrink-0" />
                  <span className="truncate">{connection.name}</span>
                  <CheckIcon
                    className={cn(
                      'ml-auto flex-shrink-0',
                      aiAnalystActiveSchemaConnectionUuid === connection.uuid ? 'visible' : 'invisible opacity-0'
                    )}
                  />
                </DropdownMenuItem>
              );
            })}
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
};
