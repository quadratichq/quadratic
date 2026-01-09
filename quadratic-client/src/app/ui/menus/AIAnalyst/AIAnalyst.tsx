import {
  aiAnalystCurrentChatMessagesCountAtom,
  aiAnalystShowChatHistoryAtom,
  showAIAnalystAtom,
} from '@/app/atoms/aiAnalystAtom';
import { presentationModeAtom } from '@/app/atoms/gridSettingsAtom';
import { events } from '@/app/events/events';
import { sheets } from '@/app/grid/controller/Sheets';
import { getExtension, getFileTypeFromName, supportedFileTypesFromGrid } from '@/app/helpers/files';
import { quadraticCore } from '@/app/web-workers/quadraticCore/quadraticCore';
import { AIMessageCounterBar } from '@/app/ui/components/AIMessageCounterBar';
import { ResizeControl } from '@/app/ui/components/ResizeControl';
import { AIAnalystChatHistory } from '@/app/ui/menus/AIAnalyst/AIAnalystChatHistory';
import { AIAnalystGetChatName } from '@/app/ui/menus/AIAnalyst/AIAnalystGetChatName';
import { AIAnalystHeader } from '@/app/ui/menus/AIAnalyst/AIAnalystHeader';
import { AIAnalystMessages } from '@/app/ui/menus/AIAnalyst/AIAnalystMessages';
import { AIAnalystUserMessageForm } from '@/app/ui/menus/AIAnalyst/AIAnalystUserMessageForm';
import { useAIAnalystPanelWidth } from '@/app/ui/menus/AIAnalyst/hooks/useAIAnalystPanelWidth';
import { cn } from '@/shared/shadcn/utils';
import { memo, useCallback, useEffect, useRef, useState } from 'react';
import { useRecoilValue } from 'recoil';

export const AIAnalyst = memo(() => {
  const showAIAnalyst = useRecoilValue(showAIAnalystAtom);
  const presentationMode = useRecoilValue(presentationModeAtom);
  const showChatHistory = useRecoilValue(aiAnalystShowChatHistoryAtom);
  const messagesCount = useRecoilValue(aiAnalystCurrentChatMessagesCountAtom);
  const aiPanelRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const { panelWidth, setPanelWidth } = useAIAnalystPanelWidth();
  const [dragOver, setDragOver] = useState(false);

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

  const handleDrop = useCallback(async (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOver(false);

    const files = Array.from(e.dataTransfer.files);
    if (files.length === 0) return;

    // Split files: direct import for spreadsheet files, AI for PDFs/images
    const directImportFiles: File[] = [];
    const aiFiles: File[] = [];

    for (const file of files) {
      const extension = `.${getExtension(file.name)}`;
      if (supportedFileTypesFromGrid.includes(extension)) {
        directImportFiles.push(file);
      } else {
        // PDFs and images need AI to extract data
        aiFiles.push(file);
      }
    }

    // Import spreadsheet files directly - each placed to the right of existing content
    if (directImportFiles.length > 0) {
      const currentSheet = sheets.sheet;

      // Sort: push Excel files to the end (they create new sheets, so order matters less)
      directImportFiles.sort((a, b) => {
        const extA = getExtension(a.name);
        const extB = getExtension(b.name);
        if (['xls', 'xlsx'].includes(extA)) return 1;
        if (['xls', 'xlsx'].includes(extB)) return -1;
        return 0;
      });

      // Import files one at a time, calculating position based on current bounds
      for (const file of directImportFiles) {
        const fileType = getFileTypeFromName(file.name);
        if (!fileType || fileType === 'Grid') continue;

        const arrayBuffer = await file.arrayBuffer();

        // Calculate insert position: to the right of existing content
        const sheetBounds = currentSheet.bounds;
        const insertAt = {
          x: sheetBounds.type === 'empty' ? 1 : Number(sheetBounds.max.x) + 2,
          y: 1,
        };

        try {
          await quadraticCore.importFile({
            file: arrayBuffer,
            fileName: file.name,
            fileType,
            sheetId: currentSheet.id,
            location: insertAt,
            cursor: currentSheet.cursor.position.toString(),
            isAi: false,
          });
        } catch (error) {
          console.error('[AIAnalyst] Error importing file:', file.name, error);
        }
      }
    }

    // Send PDFs/images to AI for processing
    if (aiFiles.length > 0) {
      events.emit('aiAnalystDroppedFiles', aiFiles);
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
                Excel, CSV, PDF, PQT, or Image supported
              </span>
            </div>
          </div>
        )}

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

              <div className="relative grid grid-rows-[1fr_auto_auto] px-2 pb-2 pt-0.5">
                {messagesCount === 0 && <div className="relative flex items-center justify-center" />}
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
            </>
          )}
        </div>
      </div>
    </>
  );
});
