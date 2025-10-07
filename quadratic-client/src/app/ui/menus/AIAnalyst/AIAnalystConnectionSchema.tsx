import { aiAnalystAtom, showAIAnalystAtom } from '@/app/atoms/aiAnalystAtom';
import { presentationModeAtom } from '@/app/atoms/gridSettingsAtom';
import { ResizeControl } from '@/app/ui/components/ResizeControl';
import { useConnectionsFetcher } from '@/app/ui/hooks/useConnectionsFetcher';
import { useAIAnalystConnectionSchemaPanelWidth } from '@/app/ui/menus/AIAnalyst/hooks/useAIAnalystPanelWidth';
import { ConnectionSchemaBrowser } from '@/shared/components/connections/ConnectionSchemaBrowser';
import { AIIcon, CloseIcon } from '@/shared/components/Icons';
import { useFileRouteLoaderData } from '@/shared/hooks/useFileRouteLoaderData';
import { Button } from '@/shared/shadcn/ui/button';
import { cn } from '@/shared/shadcn/utils';
import { memo, useCallback, useRef } from 'react';
import { useRecoilState, useRecoilValue } from 'recoil';

export const AIAnalystConnectionSchema = memo(() => {
  const {
    team: { uuid: teamUuid },
  } = useFileRouteLoaderData();
  const [showAIAnalyst, setShowAIAnalyst] = useRecoilState(showAIAnalystAtom);
  const presentationMode = useRecoilValue(presentationModeAtom);
  const panelRef = useRef<HTMLDivElement>(null);
  const { panelWidth, setPanelWidth } = useAIAnalystConnectionSchemaPanelWidth();
  const [aiAnalyst, setAIAnalyst] = useRecoilState(aiAnalystAtom);
  const { contextConnectionUuid } = aiAnalyst;
  const { connections } = useConnectionsFetcher();

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

  if (/*!showAIAnalyst ||*/ presentationMode || !contextConnectionUuid) {
    return null;
  }

  const connectionType =
    connections && contextConnectionUuid
      ? connections.find((connection) => connection.uuid === contextConnectionUuid)?.type
      : undefined;

  return (
    <div
      ref={panelRef}
      className="relative hidden h-full shrink-0 overflow-hidden md:block"
      style={{ width: `${panelWidth}px` }}
    >
      <ResizeControl position="VERTICAL" style={{ left: `${panelWidth - 1}px` }} setState={handleResize} />

      <div className={cn('h-full w-full')}>
        <div className="-mb-2 flex h-11 w-full items-center justify-end px-4 py-2">
          <h3 className="text-sm font-semibold">Schema</h3>
          <div className="ml-auto flex items-center gap-2">
            <Button
              size="icon-sm"
              variant="ghost"
              className="text-muted-foreground"
              disabled={showAIAnalyst}
              onClick={() => setShowAIAnalyst(true)}
            >
              <AIIcon />
            </Button>
            <Button
              onClick={() => setAIAnalyst({ ...aiAnalyst, contextConnectionUuid: undefined })}
              size="icon-sm"
              variant="ghost"
              className="ml-auto text-muted-foreground"
            >
              <CloseIcon />
            </Button>
          </div>
        </div>
        <ConnectionSchemaBrowser
          TableQueryAction={() => <Button size="sm">Insert</Button>}
          selfContained={false}
          teamUuid={teamUuid}
          type={connectionType}
          uuid={contextConnectionUuid}
        />
      </div>
    </div>
  );
});
