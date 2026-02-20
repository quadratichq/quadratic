import { activeSchemaConnectionUuidAtom } from '@/app/ai/atoms/aiAnalystAtoms';
import { agentModeAtom } from '@/app/atoms/agentModeAtom';
import { presentationModeAtom } from '@/app/atoms/gridSettingsAtom';
import { ResizeControl } from '@/app/ui/components/ResizeControl';
import { useConnectionsFetcher } from '@/app/ui/hooks/useConnectionsFetcher';
import { useAIAnalystConnectionSchemaPanelWidth } from '@/app/ui/menus/AIAnalyst/hooks/useAIAnalystPanelWidth';
import { ConnectionSchemaBrowser } from '@/shared/components/connections/ConnectionSchemaBrowser';
import { ChevronLeftIcon } from '@/shared/components/Icons';
import { useFileRouteLoaderData } from '@/shared/hooks/useFileRouteLoaderData';
import { Button } from '@/shared/shadcn/ui/button';
import { useAtom } from 'jotai';
import { memo, useCallback, useEffect, useRef } from 'react';
import { useRecoilValue } from 'recoil';

export const AIAnalystConnectionSchema = memo(() => {
  const {
    team: { uuid: teamUuid },
  } = useFileRouteLoaderData();
  const presentationMode = useRecoilValue(presentationModeAtom);
  const panelRef = useRef<HTMLDivElement>(null);
  const { panelWidth, setPanelWidth } = useAIAnalystConnectionSchemaPanelWidth();
  const [aiAnalystActiveSchemaConnectionUuid, setAIAnalystActiveSchemaConnectionUuid] =
    useAtom(activeSchemaConnectionUuidAtom);
  const { connections } = useConnectionsFetcher();
  const agentMode = useRecoilValue(agentModeAtom);

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

  const connection =
    connections && aiAnalystActiveSchemaConnectionUuid
      ? connections.find((connection) => connection.uuid === aiAnalystActiveSchemaConnectionUuid)
      : undefined;
  const connectionType = connection?.type;

  useEffect(() => {
    if (aiAnalystActiveSchemaConnectionUuid && connections && !connection) {
      setAIAnalystActiveSchemaConnectionUuid(undefined);
    }
  }, [aiAnalystActiveSchemaConnectionUuid, connections, connection, setAIAnalystActiveSchemaConnectionUuid]);

  if (presentationMode || !aiAnalystActiveSchemaConnectionUuid || !connectionType) {
    return null;
  }

  return (
    <div
      ref={panelRef}
      className="relative hidden h-full shrink-0 overflow-hidden md:block"
      style={{ width: `${panelWidth}px` }}
    >
      <ResizeControl
        className={agentMode ? 'resize-control--invisible' : ''}
        position="VERTICAL"
        style={{ left: `${panelWidth - 1}px` }}
        setState={handleResize}
      />

      <div className="h-full w-full pt-0.5">
        <ConnectionSchemaBrowser
          additionalActions={
            <Button
              onClick={() => setAIAnalystActiveSchemaConnectionUuid(undefined)}
              size="icon-sm"
              variant="ghost"
              className="text-muted-foreground"
            >
              <ChevronLeftIcon />
            </Button>
          }
          teamUuid={teamUuid}
          type={connectionType}
          uuid={aiAnalystActiveSchemaConnectionUuid}
          eventSource="app-left-side"
        />
      </div>
    </div>
  );
});
