import {
  aiAnalystCurrentChatMessagesAtom,
  aiAnalystCurrentChatMessagesCountAtom,
  aiAnalystLoadingAtom,
} from '@/app/atoms/aiAnalystAtom';
import { events } from '@/app/events/events';
import { sheets } from '@/app/grid/controller/Sheets';
import { uploadFile } from '@/app/helpers/files';
import { A1SelectionStringToSelection } from '@/app/quadratic-rust-client/quadratic_rust_client';
import { AIAnalystSelectContextMenu } from '@/app/ui/menus/AIAnalyst/AIAnalystSelectContextMenu';
import { defaultAIAnalystContext } from '@/app/ui/menus/AIAnalyst/const/defaultAIAnalystContext';
import { AttachFileIcon, CloseIcon } from '@/shared/components/Icons';
import { Button } from '@/shared/shadcn/ui/button';
import { HoverCard, HoverCardContent, HoverCardTrigger } from '@/shared/shadcn/ui/hover-card';
import { TooltipPopover } from '@/shared/shadcn/ui/tooltip';
import { cn } from '@/shared/shadcn/utils';
import { getFileTypeLabel } from 'quadratic-shared/ai/helpers/files.helper';
import type { Context, FileContent, UserMessagePrompt } from 'quadratic-shared/typesAndSchemasAI';
import { memo, useCallback, useEffect, useMemo, useState } from 'react';
import { useRecoilValue } from 'recoil';

type AIContextProps = {
  initialContext?: Context;
  context?: Context;
  setContext?: React.Dispatch<React.SetStateAction<Context>>;
  files: FileContent[];
  setFiles: React.Dispatch<React.SetStateAction<FileContent[]>>;
  handleFiles: (files: FileList | File[]) => void;
  fileTypes: string[];
  editing: boolean;
  disabled: boolean;
  textAreaRef: React.RefObject<HTMLTextAreaElement>;
};

export const AIContext = memo(
  ({
    initialContext,
    context,
    setContext,
    files,
    setFiles,
    handleFiles,
    fileTypes,
    editing,
    disabled,
    textAreaRef,
  }: AIContextProps) => {
    const loading = useRecoilValue(aiAnalystLoadingAtom);
    const messages = useRecoilValue(aiAnalystCurrentChatMessagesAtom);
    const messagesCount = useRecoilValue(aiAnalystCurrentChatMessagesCountAtom);
    const [, setCurrentSheet] = useState(sheets.sheet.name);

    useEffect(() => {
      if (loading || !editing) return;

      const updateSelection = () => {
        setContext?.((prev) => ({
          ...prev,
          selection: sheets.sheet.cursor.save(),
        }));
      };
      updateSelection();

      events.on('cursorPosition', updateSelection);
      events.on('changeSheet', updateSelection);
      return () => {
        events.off('cursorPosition', updateSelection);
        events.off('changeSheet', updateSelection);
      };
    }, [editing, loading, setContext]);

    useEffect(() => {
      const updateCurrentSheet = () => {
        if (!loading && editing) {
          setContext?.((prev) => ({
            ...prev,
            currentSheet: sheets.sheet.name,
          }));
        }
        setCurrentSheet(sheets.sheet.name);
      };

      updateCurrentSheet();

      events.on('changeSheet', updateCurrentSheet);
      return () => {
        events.off('changeSheet', updateCurrentSheet);
      };
    }, [editing, loading, setContext]);

    // use last user message context as initial context in the bottom user message form
    useEffect(() => {
      if (!loading && initialContext === undefined && !!setContext && messagesCount > 0) {
        const lastUserMessage = messages
          .filter(
            (message): message is UserMessagePrompt => message.role === 'user' && message.contextType === 'userPrompt'
          )
          .at(-1);
        if (lastUserMessage) {
          setContext(lastUserMessage.context ?? defaultAIAnalystContext);
        }
      }
    }, [initialContext, loading, messages, messagesCount, setContext]);

    return (
      <div
        className={cn(
          `z-10 flex select-none flex-wrap items-center gap-1 px-2 text-xs`,
          disabled && 'select-none opacity-60',
          loading && 'select-none opacity-60'
        )}
      >
        {editing && context && setContext && (
          <AIAnalystSelectContextMenu
            context={context}
            setContext={setContext}
            disabled={disabled}
            onClose={() => textAreaRef.current?.focus()}
          />
        )}

        <AttachFileButton disabled={disabled} handleFiles={handleFiles} fileTypes={fileTypes} />

        {files.map((file, index) => (
          <HoverCard key={`${index}-${file.fileName}`}>
            <HoverCardTrigger>
              <ContextPill
                primary={file.fileName}
                secondary={getFileTypeLabel(file.mimeType)}
                disabled={disabled}
                onClick={() => setFiles?.(files.filter((f) => f !== file))}
              />
            </HoverCardTrigger>
            <HoverCardContent className="w-48" side="top">
              {/* TODO:(ayush) add the preview image for a file here */}
              <img src="https://picsum.photos/600/400" alt="preview" crossOrigin="anonymous" />
            </HoverCardContent>
          </HoverCard>
        ))}

        {setContext && context && (
          <ContextPill
            key="cursor"
            primary={
              context.selection
                ? A1SelectionStringToSelection(context.selection, sheets.a1Context).toA1String(sheets.current)
                : sheets.sheet.cursor.toCursorA1()
            }
            secondary="Cursor"
            onClick={() => setContext((prev) => ({ ...prev, selection: undefined }))}
            disabled={disabled || !context.selection}
          />
        )}

        {!!setContext && !!context?.currentSheet && (
          <ContextPill
            key={context.currentSheet}
            primary={context.currentSheet}
            secondary={'Sheet'}
            onClick={() =>
              setContext((prev) => ({
                ...prev,
                sheets: prev.sheets.filter((sheet) => sheet !== prev.currentSheet),
                currentSheet: '',
              }))
            }
            disabled={disabled}
          />
        )}

        {setContext &&
          context?.sheets
            .filter((sheet) => sheet !== context.currentSheet)
            .map((sheet) => (
              <ContextPill
                key={sheet}
                primary={sheet}
                secondary={'Sheet'}
                disabled={disabled}
                onClick={() =>
                  setContext((prev) => ({
                    ...prev,
                    sheets: prev.sheets.filter((prevSheet) => prevSheet !== sheet),
                    currentSheet: prev.currentSheet === sheet ? '' : prev.currentSheet,
                  }))
                }
              />
            ))}
      </div>
    );
  }
);

type ContextPillProps = {
  primary: string;
  secondary: string;
  onClick: () => void;
  disabled: boolean;
};

const ContextPill = memo(({ primary, secondary, onClick, disabled }: ContextPillProps) => {
  return (
    <div className="flex h-5 items-center self-stretch rounded border border-border px-1 text-xs">
      <span className="max-w-24 truncate">{primary}</span>

      <span className="ml-0.5 text-muted-foreground">{secondary}</span>

      {!disabled && (
        <Button
          size="icon-sm"
          className="-mr-0.5 ml-0 h-4 w-4 items-center shadow-none"
          variant="ghost"
          onClick={onClick}
        >
          <CloseIcon className="!h-4 !w-4 !text-xs" />
        </Button>
      )}
    </div>
  );
});

type AttachFileButtonProps = {
  disabled: boolean;
  handleFiles: (files: FileList | File[]) => void;
  fileTypes: string[];
};

const AttachFileButton = memo(({ disabled, handleFiles, fileTypes }: AttachFileButtonProps) => {
  const handleUploadFiles = useCallback(async () => {
    const files = await uploadFile(fileTypes);
    handleFiles(files);
  }, [handleFiles, fileTypes]);

  const label = useMemo(() => (fileTypes.includes('.pdf') ? 'Attach image or PDF' : 'Attach image'), [fileTypes]);

  return (
    <TooltipPopover label={label}>
      <Button
        size="icon-sm"
        className="h-5 w-5 shadow-none"
        variant="outline"
        onClick={handleUploadFiles}
        disabled={disabled}
      >
        <AttachFileIcon className="!h-5 !w-5 !text-sm" />
      </Button>
    </TooltipPopover>
  );
});
