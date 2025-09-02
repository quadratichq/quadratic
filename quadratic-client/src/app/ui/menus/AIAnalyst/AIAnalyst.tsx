import {
  aiAnalystCurrentChatMessagesCountAtom,
  aiAnalystShowChatHistoryAtom,
  showAIAnalystAtom,
} from '@/app/atoms/aiAnalystAtom';
import { presentationModeAtom } from '@/app/atoms/gridSettingsAtom';
import { AIUserMessageFormDisclaimer } from '@/app/ui/components/AIUserMessageFormDisclaimer';
import { ResizeControl } from '@/app/ui/components/ResizeControl';
import { AIAnalystChatHistory } from '@/app/ui/menus/AIAnalyst/AIAnalystChatHistory';
import { AIAnalystGetChatName } from '@/app/ui/menus/AIAnalyst/AIAnalystGetChatName';
import { AIAnalystHeader } from '@/app/ui/menus/AIAnalyst/AIAnalystHeader';
import { AIAnalystMessages } from '@/app/ui/menus/AIAnalyst/AIAnalystMessages';
import { AIAnalystUserMessageForm } from '@/app/ui/menus/AIAnalyst/AIAnalystUserMessageForm';
import { useAIAnalystPanelWidth } from '@/app/ui/menus/AIAnalyst/hooks/useAIAnalystPanelWidth';
import { LanguageIcon } from '@/shared/components/LanguageIcon';
import { cn } from '@/shared/shadcn/utils';
import { memo, useCallback, useEffect, useRef } from 'react';
import { useRecoilValue } from 'recoil';

export const AIAnalyst = memo(() => {
  const showAIAnalyst = useRecoilValue(showAIAnalystAtom);
  const presentationMode = useRecoilValue(presentationModeAtom);
  const showChatHistory = useRecoilValue(aiAnalystShowChatHistoryAtom);
  const messagesCount = useRecoilValue(aiAnalystCurrentChatMessagesCountAtom);
  const aiPanelRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const { panelWidth, setPanelWidth } = useAIAnalystPanelWidth();
  const isEmptyState = messagesCount === 0 && !showChatHistory;

  const initialLoadRef = useRef(true);
  const autoFocusRef = useRef(false);
  useEffect(() => {
    if (initialLoadRef.current) {
      initialLoadRef.current = false;
    } else {
      autoFocusRef.current = true;
    }
  }, [showAIAnalyst]);

  const handleResize = useCallback(
    (event: MouseEvent) => {
      const panel = aiPanelRef.current;
      if (!panel) return;
      event.stopPropagation();
      event.preventDefault();

      const containerRect = panel.getBoundingClientRect();
      const newPanelWidth = event.x - (containerRect.left - 2);
      setPanelWidth(newPanelWidth);
    },
    [setPanelWidth]
  );

  const promptUI = (
    <AIAnalystUserMessageForm
      ref={textareaRef}
      autoFocusRef={autoFocusRef}
      textareaRef={textareaRef}
      messageIndex={messagesCount}
    />
  );

  if (!showAIAnalyst || presentationMode) {
    return null;
  }

  return (
    <>
      <AIAnalystGetChatName />

      <div
        ref={aiPanelRef}
        className="relative hidden h-full shrink-0 overflow-hidden md:block"
        style={{ width: `${panelWidth}px` }}
        onCopy={(e) => e.stopPropagation()}
        onCut={(e) => e.stopPropagation()}
        onPaste={(e) => e.stopPropagation()}
      >
        <ResizeControl position="VERTICAL" style={{ left: `${panelWidth - 1}px` }} setState={handleResize} />

        <div
          className={cn(
            'h-full w-full',
            showChatHistory ? 'grid grid-rows-[auto_1fr]' : 'grid grid-rows-[auto_1fr_auto]'
          )}
        >
          <AIAnalystHeader textareaRef={textareaRef} />

          {showChatHistory ? (
            <AIAnalystChatHistory />
          ) : (
            <>
              {isEmptyState ? (
                <div className="flex h-full flex-col justify-center gap-2 px-2 py-0.5">
                  {promptUI}
                  <AIAnalystEmptyStateWaypoint />
                </div>
              ) : (
                <AIAnalystMessages textareaRef={textareaRef} />
              )}

              <div className="px-2 py-0.5">
                {!isEmptyState && promptUI}
                <AIUserMessageFormDisclaimer />
              </div>
            </>
          )}
        </div>
      </div>
    </>
  );
});

function AIAnalystEmptyStateWaypoint() {
  return (
    <div className="relative">
      <div className="ml-2.5 flex flex-col">
        <svg
          width="16"
          height="100"
          viewBox="0 0 16 100"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className="text-border"
        >
          <path
            d="M8.70715 0.292894C8.31662 -0.0976309 7.68346 -0.0976312 7.29293 0.292893L0.92897 6.65685C0.538446 7.04738 0.538445 7.68054 0.928969 8.07106C1.31949 8.46159 1.95266 8.46159 2.34318 8.07107L8.00004 2.41421L13.6569 8.07107C14.0474 8.46159 14.6806 8.4616 15.0711 8.07107C15.4616 7.68055 15.4616 7.04738 15.0711 6.65686L8.70715 0.292894ZM8 100L9 100L9.00004 1L8.00004 1L7.00004 1L7 100L8 100Z"
            fill="currentColor"
          />
        </svg>
        <h3 className="mt-2 text-sm font-medium">Upload a file</h3>
        <p className="text-xs text-muted-foreground">CSV, Excel, PDF, or Parquet</p>
      </div>
      <div className="absolute left-11 top-0 flex flex-row gap-2.5">
        <svg
          width="86"
          height="56"
          viewBox="0 0 86 56"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className="flex-shrink-0 text-border"
        >
          <path
            d="M8.00005 54.9584L7.00005 54.9584L7.00004 55.9584L8.00005 55.9584L8.00005 54.9584ZM8.70807 0.292181C8.31755 -0.0983497 7.68439 -0.0983602 7.29386 0.292158L0.929789 6.65601C0.539259 7.04653 0.539248 7.6797 0.929766 8.07023C1.32028 8.46076 1.95345 8.46077 2.34398 8.07025L8.00093 2.41349L13.6577 8.07044C14.0482 8.46097 14.6814 8.46098 15.0719 8.07046C15.4624 7.67994 15.4624 7.04678 15.0719 6.65625L8.70807 0.292181ZM126 54.9587L126 53.9587L8.00006 53.9584L8.00005 54.9584L8.00005 55.9584L126 55.9587L126 54.9587ZM8.00005 54.9584L9.00005 54.9584L9.00095 0.999293L8.00095 0.999276L7.00095 0.999259L7.00005 54.9584L8.00005 54.9584Z"
            fill="currentColor"
          />
        </svg>
        <div className="mt-4 flex flex-col">
          <div className="flex flex-row gap-2">
            <LanguageIcon language="postgres" />
            <LanguageIcon language="mysql" />
            <LanguageIcon language="mssql" />
          </div>
          <h3 className="mt-2 text-sm font-medium">Chat with your data</h3>
          <p className="text-xs text-muted-foreground">Postgres, MySQL, Microsoft SQL, & more.</p>
        </div>
      </div>
    </div>
  );
}
