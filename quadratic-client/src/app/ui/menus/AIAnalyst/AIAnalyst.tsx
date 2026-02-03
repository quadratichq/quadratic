import {
  aiAnalystActiveSchemaConnectionUuidAtom,
  aiAnalystCurrentChatMessagesCountAtom,
  aiAnalystShowChatHistoryAtom,
  showAIAnalystAtom,
} from '@/app/atoms/aiAnalystAtom';
import { presentationModeAtom } from '@/app/atoms/gridSettingsAtom';
import { events } from '@/app/events/events';
import { AIMessageCounterBar } from '@/app/ui/components/AIMessageCounterBar';
import { ResizeControl } from '@/app/ui/components/ResizeControl';
import { AIAnalystChatHistory } from '@/app/ui/menus/AIAnalyst/AIAnalystChatHistory';
import { AIAnalystGetChatName } from '@/app/ui/menus/AIAnalyst/AIAnalystGetChatName';
import { AIAnalystHeader } from '@/app/ui/menus/AIAnalyst/AIAnalystHeader';
import { AIAnalystMessages } from '@/app/ui/menus/AIAnalyst/AIAnalystMessages';
import { AIAnalystUserMessageForm } from '@/app/ui/menus/AIAnalyst/AIAnalystUserMessageForm';
import { AIPendingChanges } from '@/app/ui/menus/AIAnalyst/AIPendingChanges';
import { useAIAnalystPanelWidth } from '@/app/ui/menus/AIAnalyst/hooks/useAIAnalystPanelWidth';
import { useSubmitAIAnalystPrompt } from '@/app/ui/menus/AIAnalyst/hooks/useSubmitAIAnalystPrompt';
import { cn } from '@/shared/shadcn/utils';
import { createTextContent } from 'quadratic-shared/ai/helpers/message.helper';
import type { ConnectionType } from 'quadratic-shared/typesAndSchemasConnections';
import { memo, useCallback, useEffect, useRef } from 'react';
import { useRecoilValue, useSetRecoilState } from 'recoil';

export const AIAnalyst = memo(() => {
  const showAIAnalyst = useRecoilValue(showAIAnalystAtom);
  const presentationMode = useRecoilValue(presentationModeAtom);
  const showChatHistory = useRecoilValue(aiAnalystShowChatHistoryAtom);
  const messagesCount = useRecoilValue(aiAnalystCurrentChatMessagesCountAtom);
  const setAIAnalystActiveSchemaConnectionUuid = useSetRecoilState(aiAnalystActiveSchemaConnectionUuidAtom);
  const aiPanelRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const { panelWidth, setPanelWidth } = useAIAnalystPanelWidth();
  const { submitPrompt } = useSubmitAIAnalystPrompt();

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

  // Listen for new connection prompt events
  useEffect(() => {
    const handleNewConnectionPrompt = (connectionUuid: string, connectionType: string, connectionName: string) => {
      // Open the schema browser with the new connection
      setAIAnalystActiveSchemaConnectionUuid(connectionUuid);

      // Submit a prompt to help the user understand how to use their new connection
      submitPrompt({
        messageSource: 'NewConnection',
        content: [createTextContent('Help me understand how to use my new connection.')],
        context: {
          connection: {
            type: connectionType as ConnectionType,
            id: connectionUuid,
            name: connectionName,
          },
        },
        messageIndex: 0,
        importFiles: [],
      });
    };

    events.on('aiAnalystNewConnectionPrompt', handleNewConnectionPrompt);
    return () => {
      events.off('aiAnalystNewConnectionPrompt', handleNewConnectionPrompt);
    };
  }, [setAIAnalystActiveSchemaConnectionUuid, submitPrompt]);

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
                  'grid pt-0.5',
                  messagesCount === 0 ? 'grid-rows-[auto_1fr_auto_auto]' : 'relative grid-rows-[auto_auto]'
                )}
              >
                <AIPendingChanges />
                <div className="px-2 pb-2" data-walkthrough="ai-chat-input">
                  <AIAnalystUserMessageForm
                    ref={textareaRef}
                    autoFocusRef={autoFocusRef}
                    textareaRef={textareaRef}
                    messageIndex={messagesCount}
                    showEmptyChatPromptSuggestions={messagesCount === 0}
                    uiContext="analyst-new-chat"
                  />
                  <AIMessageCounterBar />
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </>
  );
});
