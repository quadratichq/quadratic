import { currentChatMessagesCountAtom, showAIAnalystAtom, showChatHistoryAtom } from '@/app/ai/atoms/aiAnalystAtoms';
import { agentModeAtom } from '@/app/atoms/agentModeAtom';
import { presentationModeAtom } from '@/app/atoms/gridSettingsAtom';
import { events } from '@/app/events/events';
import { sheets } from '@/app/grid/controller/Sheets';
import { importFilesToSheet } from '@/app/helpers/files';
import { AIMessageCounterBar } from '@/app/ui/components/AIMessageCounterBar';
import { ResizeControl } from '@/app/ui/components/ResizeControl';
import { AIAnalystChatHistory } from '@/app/ui/menus/AIAnalyst/AIAnalystChatHistory';
import { AIAnalystGetChatName } from '@/app/ui/menus/AIAnalyst/AIAnalystGetChatName';
import { AIAnalystHeader } from '@/app/ui/menus/AIAnalyst/AIAnalystHeader';
import { AIAnalystMessages } from '@/app/ui/menus/AIAnalyst/AIAnalystMessages';
import { AIAnalystUserMessageForm } from '@/app/ui/menus/AIAnalyst/AIAnalystUserMessageForm';
import { AIPendingChanges } from '@/app/ui/menus/AIAnalyst/AIPendingChanges';
import { useAIAnalystPanelWidth } from '@/app/ui/menus/AIAnalyst/hooks/useAIAnalystPanelWidth';
import { quadraticCore } from '@/app/web-workers/quadraticCore/quadraticCore';
import { filesImportProgressAtom } from '@/dashboard/atoms/filesImportProgressAtom';
import { cn } from '@/shared/shadcn/utils';
import { useAtomValue } from 'jotai';
import { memo, useCallback, useEffect, useRef, useState } from 'react';
import { useRecoilValue, useSetRecoilState } from 'recoil';

export const AIAnalyst = memo(() => {
  const showAIAnalyst = useAtomValue(showAIAnalystAtom);
  const presentationMode = useRecoilValue(presentationModeAtom);
  const showChatHistory = useAtomValue(showChatHistoryAtom);
  const messagesCount = useAtomValue(currentChatMessagesCountAtom);
  const aiPanelRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const { panelWidth, setPanelWidth } = useAIAnalystPanelWidth();
  const [dragOver, setDragOver] = useState(false);
  const agentMode = useRecoilValue(agentModeAtom);
  const setFilesImportProgressState = useSetRecoilState(filesImportProgressAtom);

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

  const handleDrag = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOver(e.type !== 'dragleave');
  }, []);

  const handleDrop = useCallback(
    async (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      e.stopPropagation();
      setDragOver(false);

      const files = Array.from(e.dataTransfer.files);
      const currentSheet = sheets.sheet;

      const aiFiles = await importFilesToSheet({
        files,
        sheetId: currentSheet.id,
        getBounds: () => currentSheet.bounds,
        getCursorPosition: () => currentSheet.cursor.position.toString(),
        setProgressState: setFilesImportProgressState,
        importFile: quadraticCore.importFile,
      });

      // Send PDFs/images to AI for processing
      if (aiFiles.length > 0) {
        events.emit('aiAnalystDroppedFiles', aiFiles);
      }
    },
    [setFilesImportProgressState]
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
        onDragEnter={handleDrag}
        onDragOver={handleDrag}
        onDragLeave={handleDrag}
        onDrop={handleDrop}
      >
        {/* Drag overlay */}
        {dragOver && (
          <div className="absolute inset-2 z-20 flex flex-col items-center justify-center rounded bg-background opacity-90">
            <div className="pointer-events-none relative z-10 flex h-full w-full select-none flex-col items-center justify-center rounded-md border-4 border-dashed border-primary p-4">
              <span className="text-sm font-bold">Drop files here</span>
              <span className="pl-4 pr-4 text-center text-xs text-muted-foreground">
                Excel, CSV, PDF, Parquet, or Image supported
              </span>
            </div>
          </div>
        )}

        <ResizeControl
          className={agentMode ? 'resize-control--invisible' : ''}
          position="VERTICAL"
          style={{ left: `${panelWidth - 1}px` }}
          setState={handleResize}
        />

        <div
          className={cn(
            'grid h-full w-full',
            showChatHistory
              ? 'grid-rows-[auto_1fr]'
              : messagesCount === 0
                ? 'grid-rows-[auto_auto_1fr]'
                : 'grid-rows-[auto_1fr_auto]'
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
                  'pt-0.5',
                  messagesCount === 0 ? 'flex min-h-0 flex-col' : 'relative grid grid-rows-[auto_auto]'
                )}
              >
                <AIPendingChanges />
                <div
                  className={cn('px-2 pb-2', messagesCount === 0 && 'flex min-h-0 flex-1 flex-col')}
                  data-walkthrough="ai-chat-input"
                >
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
