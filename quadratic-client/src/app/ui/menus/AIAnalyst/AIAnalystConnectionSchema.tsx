import { showAIAnalystAtom } from '@/app/atoms/aiAnalystAtom';
import { connectionsPanelAtom } from '@/app/atoms/connectionsPanelAtom';
import { editorInteractionStateShowConnectionsMenuAtom } from '@/app/atoms/editorInteractionStateAtom';
import { ResizeControl } from '@/app/ui/components/ResizeControl';
import { useConnectionsFetcher } from '@/app/ui/hooks/useConnectionsFetcher';
import { useAIAnalystConnectionSchemaPanelWidth } from '@/app/ui/menus/AIAnalyst/hooks/useAIAnalystPanelWidth';
import { ConnectionSchemaBrowser } from '@/shared/components/connections/ConnectionSchemaBrowser';
import { AIIcon, CloseIcon, SettingsIcon } from '@/shared/components/Icons';
import { LanguageIcon } from '@/shared/components/LanguageIcon';
import { useFileRouteLoaderData } from '@/shared/hooks/useFileRouteLoaderData';
import { Button } from '@/shared/shadcn/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/shadcn/ui/select';
import { TooltipPopover } from '@/shared/shadcn/ui/tooltip';
import { memo, useCallback, useRef } from 'react';
import { useRecoilState, useSetRecoilState } from 'recoil';

export const AIAnalystConnectionSchema = memo(() => {
  const {
    team: { uuid: teamUuid },
  } = useFileRouteLoaderData();
  const panelRef = useRef<HTMLDivElement>(null);
  const { panelWidth, setPanelWidth } = useAIAnalystConnectionSchemaPanelWidth();
  const setShowConnectionsMenu = useSetRecoilState(editorInteractionStateShowConnectionsMenuAtom);
  // TODO: maybe different selectors?
  const [{ activeConnectionUuid }, setConnectionsPanel] = useRecoilState(connectionsPanelAtom);
  const [showAIAnalyst, setShowAIAnalyst] = useRecoilState(showAIAnalystAtom);
  const { connections } = useConnectionsFetcher();

  // TOOD: better UI for when you have 0 connections

  const handleResize = useCallback(
    (event: MouseEvent) => {
      const panel = panelRef.current;
      if (!panel) return;
      event.stopPropagation();
      event.preventDefault();

      const containerRect = panel.getBoundingClientRect();
      const newPanelWidth = event.x - (containerRect.left - 2);
      setPanelWidth(newPanelWidth);
    },
    [setPanelWidth]
  );

  const hasConnections = connections.length > 0;
  const activeConnection =
    connections && activeConnectionUuid
      ? connections.find((connection) => connection.uuid === activeConnectionUuid)
      : undefined;

  return (
    <div
      ref={panelRef}
      className="relative hidden h-full shrink-0 overflow-hidden md:block"
      style={{ width: `${panelWidth}px` }}
    >
      <ResizeControl position="VERTICAL" style={{ left: `${panelWidth - 1}px` }} setState={handleResize} />

      <div className="h-full w-full pt-0.5">
        <div className="flex h-10 items-center justify-between px-4">
          <h3 className="text-sm font-bold">Connections</h3>
          <div className="flex items-center gap-2">
            {!showAIAnalyst && activeConnectionUuid && hasConnections && (
              <TooltipPopover label="Chat with this connection">
                <Button
                  size="icon-sm"
                  variant="ghost"
                  className="text-muted-foreground"
                  onClick={() => {
                    // TODO: put it in context
                    // open a new chat with this connection in context
                    setShowAIAnalyst(true);
                  }}
                >
                  <AIIcon />
                </Button>
              </TooltipPopover>
            )}
            <Button
              size="icon-sm"
              variant="ghost"
              className="text-muted-foreground"
              onClick={() => setShowConnectionsMenu(true)}
            >
              <SettingsIcon />
            </Button>
            <Button
              onClick={() => setConnectionsPanel((prev) => ({ ...prev, showConnectionsPanel: false }))}
              size="icon-sm"
              variant="ghost"
              className="text-muted-foreground"
            >
              <CloseIcon />
            </Button>
          </div>
        </div>
        <div className="px-2 py-1">
          {hasConnections ? (
            <Select
              value={activeConnectionUuid ?? ''}
              onValueChange={(value) => setConnectionsPanel((prev) => ({ ...prev, activeConnectionUuid: value }))}
            >
              <SelectTrigger>
                <SelectValue asChild placeholder="Choose a connection…">
                  <div className="flex items-center gap-2">
                    <LanguageIcon language={activeConnection?.type} />{' '}
                    {activeConnection ? activeConnection.name : 'Choose a connection…'}
                  </div>
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {connections.map((connection) => (
                  <SelectItem key={connection.uuid} value={connection.uuid}>
                    <div className="flex items-center gap-2 truncate">
                      <LanguageIcon language={connection.type} /> {connection.name}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : (
            <div className="text-center text-sm text-muted-foreground">
              No available connections.{' '}
              <button onClick={() => setShowConnectionsMenu(true)} className="text-primary hover:underline">
                Manage them.
              </button>
            </div>
          )}
        </div>
        {activeConnectionUuid && activeConnection && hasConnections && (
          <ConnectionSchemaBrowser
            showHeader={false}
            teamUuid={teamUuid}
            type={activeConnection.type}
            uuid={activeConnectionUuid}
            eventSource="app-left-side"
          />
        )}
      </div>
    </div>
  );
});
