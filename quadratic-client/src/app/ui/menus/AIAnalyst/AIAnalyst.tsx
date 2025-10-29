import {
  aiAnalystCurrentChatAtom,
  aiAnalystCurrentChatMessagesCountAtom,
  aiAnalystShowChatHistoryAtom,
  showAIAnalystAtom,
} from '@/app/atoms/aiAnalystAtom';
import { connectionsPanelAtom } from '@/app/atoms/connectionsPanelAtom';
import { presentationModeAtom } from '@/app/atoms/gridSettingsAtom';
import { events } from '@/app/events/events';
import { AIMessageCounterBar } from '@/app/ui/components/AIMessageCounterBar';
import { ResizeControl } from '@/app/ui/components/ResizeControl';
import { useConnectionsFetcher } from '@/app/ui/hooks/useConnectionsFetcher';
import { AIAnalystChatHistory } from '@/app/ui/menus/AIAnalyst/AIAnalystChatHistory';
import { AIAnalystGetChatName } from '@/app/ui/menus/AIAnalyst/AIAnalystGetChatName';
import { AIAnalystHeader } from '@/app/ui/menus/AIAnalyst/AIAnalystHeader';
import { AIAnalystMessages } from '@/app/ui/menus/AIAnalyst/AIAnalystMessages';
import { AIAnalystUserMessageForm } from '@/app/ui/menus/AIAnalyst/AIAnalystUserMessageForm';
import { useAIAnalystPanelWidth } from '@/app/ui/menus/AIAnalyst/hooks/useAIAnalystPanelWidth';
import { cn } from '@/shared/shadcn/utils';
import { memo, useCallback, useEffect, useMemo, useRef } from 'react';
import { useRecoilValue } from 'recoil';

export const AIAnalyst = memo(() => {
  const showAIAnalyst = useRecoilValue(showAIAnalystAtom);
  const presentationMode = useRecoilValue(presentationModeAtom);
  const showChatHistory = useRecoilValue(aiAnalystShowChatHistoryAtom);
  const messagesCount = useRecoilValue(aiAnalystCurrentChatMessagesCountAtom);
  const aiPanelRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const connectionsPanel = useRecoilValue(connectionsPanelAtom);
  const currentChat = useRecoilValue(aiAnalystCurrentChatAtom);
  const { connections } = useConnectionsFetcher();
  const { panelWidth, setPanelWidth } = useAIAnalystPanelWidth();

  const initialLoadRef = useRef(true);
  const autoFocusRef = useRef(false);
  useEffect(() => {
    if (initialLoadRef.current) {
      initialLoadRef.current = false;
    } else {
      autoFocusRef.current = true;
    }
  }, [showAIAnalyst]);

  // Emit ready event when AIAnalyst is rendered
  useEffect(() => {
    if (showAIAnalyst && !presentationMode) {
      events.emit('aiAnalystReady');
    }
  }, [showAIAnalyst, presentationMode]);

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

  const handleDrop = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    const files = e.dataTransfer.files;
    if (files.length > 0) {
      events.emit('aiAnalystDroppedFiles', files);
    }
  }, []);

  // TODO: consider fixing this hook (if necessary)
  // What about case where there's no active connection currently? Handle this
  const initialContext = useMemo(() => {
    if (showAIAnalyst && currentChat.id === '' && connectionsPanel.showConnectionsPanel) {
      const activeConnection = connections.find(
        (connection) => connection.uuid === connectionsPanel.activeConnectionUuid
      );
      if (activeConnection) {
        const out = {
          connection: {
            type: activeConnection.type,
            id: activeConnection.uuid,
            name: activeConnection.name,
          },
        };
        console.log('set initialContext', out);
        return out;
      }
    }
    return undefined;
  }, [currentChat, showAIAnalyst, connectionsPanel, connections]);

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
        onDragOver={handleDrop}
        onDrop={handleDrop}
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
              <AIAnalystMessages textareaRef={textareaRef} />

              <div
                className={cn(
                  'px-2 pb-2 pt-0.5',
                  messagesCount === 0 ? 'grid grid-rows-[1fr_auto]' : 'grid grid-rows-[1fr_auto_auto]'
                )}
              >
                <AIAnalystUserMessageForm
                  ref={textareaRef}
                  autoFocusRef={autoFocusRef}
                  textareaRef={textareaRef}
                  messageIndex={messagesCount}
                  showEmptyChatPromptSuggestions={true}
                  initialContext={initialContext}
                  uiContext="analyst-new-chat"
                />
                <AIMessageCounterBar />
              </div>
            </>
          )}
        </div>
      </div>
    </>
  );
});
