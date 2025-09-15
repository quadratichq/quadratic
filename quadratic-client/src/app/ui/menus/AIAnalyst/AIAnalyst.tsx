import {
  aiAnalystCurrentChatMessagesCountAtom,
  aiAnalystShowChatHistoryAtom,
  showAIAnalystAtom,
} from '@/app/atoms/aiAnalystAtom';
import { presentationModeAtom } from '@/app/atoms/gridSettingsAtom';
import { events } from '@/app/events/events';
import { AIUserMessageFormDisclaimer } from '@/app/ui/components/AIUserMessageFormDisclaimer';
import { ResizeControl } from '@/app/ui/components/ResizeControl';
import { AIAnalystChatHistory } from '@/app/ui/menus/AIAnalyst/AIAnalystChatHistory';
import { AIAnalystEmptyStateWaypoint } from '@/app/ui/menus/AIAnalyst/AIAnalystEmptyStateWaypoint';
import { AIAnalystGetChatName } from '@/app/ui/menus/AIAnalyst/AIAnalystGetChatName';
import { AIAnalystHeader } from '@/app/ui/menus/AIAnalyst/AIAnalystHeader';
import { AIAnalystMessages } from '@/app/ui/menus/AIAnalyst/AIAnalystMessages';
import { AIAnalystUserMessageForm } from '@/app/ui/menus/AIAnalyst/AIAnalystUserMessageForm';
import { useAIAnalystPanelWidth } from '@/app/ui/menus/AIAnalyst/hooks/useAIAnalystPanelWidth';
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

      events.emit('resizeAIAnalystPanel');
    },
    [setPanelWidth]
  );

  const promptUI = (
    <AIAnalystUserMessageForm
      ref={textareaRef}
      autoFocusRef={autoFocusRef}
      textareaRef={textareaRef}
      messageIndex={messagesCount}
      showPromptSuggestions={true}
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
