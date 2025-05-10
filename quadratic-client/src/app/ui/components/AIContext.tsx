import {
  aiAnalystCurrentChatMessagesAtom,
  aiAnalystCurrentChatMessagesCountAtom,
  aiAnalystLoadingAtom,
} from '@/app/atoms/aiAnalystAtom';
import { events } from '@/app/events/events';
import { sheets } from '@/app/grid/controller/Sheets';
import { uploadFile } from '@/app/helpers/files';
import { getTableNameFromPos } from '@/app/quadratic-core/quadratic_core';
import type { CodeCell } from '@/app/shared/types/codeCell';
import { defaultAIAnalystContext } from '@/app/ui/menus/AIAnalyst/const/defaultAIAnalystContext';
import { AttachFileIcon, CloseIcon } from '@/shared/components/Icons';
import { Button } from '@/shared/shadcn/ui/button';
import { HoverCard, HoverCardContent, HoverCardTrigger } from '@/shared/shadcn/ui/hover-card';
import { TooltipPopover } from '@/shared/shadcn/ui/tooltip';
import { cn } from '@/shared/shadcn/utils';
import {
  getDataBase64String,
  getFileTypeLabel,
  isSupportedImageMimeType,
} from 'quadratic-shared/ai/helpers/files.helper';
import type { Context, FileContent, UserMessagePrompt } from 'quadratic-shared/typesAndSchemasAI';
import { memo, useCallback, useEffect, useMemo, useState } from 'react';
import { useRecoilValue } from 'recoil';

type AIContextProps = {
  initialContext?: Context;
  context: Context;
  setContext?: React.Dispatch<React.SetStateAction<Context>>;
  files: FileContent[];
  setFiles: React.Dispatch<React.SetStateAction<FileContent[]>>;
  handleFiles: (files: FileList | File[]) => void;
  fileTypes: string[];
  editing: boolean;
  disabled: boolean;
  textareaRef: React.RefObject<HTMLTextAreaElement | null>;
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
    textareaRef,
  }: AIContextProps) => {
    const loading = useRecoilValue(aiAnalystLoadingAtom);
    const messages = useRecoilValue(aiAnalystCurrentChatMessagesAtom);
    const messagesCount = useRecoilValue(aiAnalystCurrentChatMessagesCountAtom);
    const [, setCurrentSheet] = useState(sheets.sheet.name);

    // useEffect(() => {
    //   if (loading || !editing) return;

    //   const updateSelection = () => {
    //     setContext?.((prev) => ({
    //       ...prev,
    //       selection: sheets.sheet.cursor.save(),
    //     }));
    //   };
    //   updateSelection();

    //   events.on('cursorPosition', updateSelection);
    //   events.on('changeSheet', updateSelection);
    //   return () => {
    //     events.off('cursorPosition', updateSelection);
    //     events.off('changeSheet', updateSelection);
    //   };
    // }, [editing, loading, setContext]);

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

    // const handleOnCloseSelectContextMenu = useCallback(() => {
    //   textareaRef.current?.focus();
    // }, [textareaRef]);

    const handleOnClickFileContext = useCallback(
      (file: FileContent) => {
        setFiles?.((prev) => prev.filter((f) => f !== file));
      },
      [setFiles]
    );

    // const handleOnClickSelection = useCallback(() => {
    //   setContext?.((prev) => ({ ...prev, selection: undefined }));
    // }, [setContext]);

    // const handleOnClickCurrentSheet = useCallback(() => {
    //   setContext?.((prev) => ({
    //     ...prev,
    //     sheets: prev.sheets.filter((sheet) => sheet !== prev.currentSheet),
    //     currentSheet: '',
    //   }));
    // }, [setContext]);

    return (
      <div
        className={cn(
          `z-10 flex select-none flex-wrap items-center gap-1 px-2 text-xs`,
          disabled && 'select-none opacity-60',
          loading && 'select-none opacity-60'
        )}
      >
        {/* {editing && context && setContext && (
          <AIAnalystSelectContextMenu
            context={context}
            setContext={setContext}
            disabled={disabled}
            onClose={handleOnCloseSelectContextMenu}
          />
        )} */}

        <AttachFileButton disabled={disabled} handleFiles={handleFiles} fileTypes={fileTypes} />

        {files.map((file, index) => (
          <FileContextPill
            key={`${index}-${file.fileName}`}
            disabled={disabled || !setFiles}
            file={file}
            onClick={() => handleOnClickFileContext(file)}
          />
        ))}

        <CodeCellContextPill codeCell={context.codeCell} />

        {/* {setContext && context && (
          <ContextPill
            key="cursor"
            primary={
              context.selection
                ? A1SelectionStringToSelection(context.selection, sheets.a1Context).toA1String(sheets.current)
                : sheets.sheet.cursor.toCursorA1()
            }
            secondary="Cursor"
            onClick={handleOnClickSelection}
            disabled={disabled || !setContext || !context.selection}
          />
        )}

        {!!context.currentSheet && (
          <ContextPill
            key={context.currentSheet}
            primary={context.currentSheet}
            secondary={'Sheet'}
            onClick={handleOnClickCurrentSheet}
            disabled={disabled || !setContext}
          />
        )} */}

        {/* {context.sheets
          .filter((sheet) => sheet !== context.currentSheet)
          .map((sheet) => (
            <ContextPill
              key={sheet}
              primary={sheet}
              secondary={'Sheet'}
              disabled={disabled || !setContext}
              onClick={() =>
                setContext?.((prev) => ({
                  ...prev,
                  sheets: prev.sheets.filter((prevSheet) => prevSheet !== sheet),
                  currentSheet: prev.currentSheet === sheet ? '' : prev.currentSheet,
                }))
              }
            />
          ))} */}
      </div>
    );
  }
);

type ContextPillProps = {
  primary: string;
  secondary: string;
  onClick?: () => void;
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

type FileContextPillProps = {
  disabled: boolean;
  file: FileContent;
  onClick: () => void;
};

const FileContextPill = memo(({ disabled, file, onClick }: FileContextPillProps) => {
  return (
    <HoverCard open={isSupportedImageMimeType(file.mimeType) ? undefined : false}>
      <HoverCardTrigger>
        <ContextPill
          primary={file.fileName}
          secondary={getFileTypeLabel(file.mimeType)}
          disabled={disabled}
          onClick={onClick}
        />
      </HoverCardTrigger>
      <HoverCardContent className="w-48 overflow-hidden p-0" side="top">
        <img src={getDataBase64String(file)} alt={file.fileName} />
        <span className="block border-t border-border px-1 py-0.5 text-xs">{file.fileName}</span>
      </HoverCardContent>
    </HoverCard>
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

type CodeCellContextPillProps = {
  codeCell: CodeCell | undefined;
};

const CodeCellContextPill = memo(({ codeCell }: CodeCellContextPillProps) => {
  const [tableName, setTableName] = useState<string | undefined>(undefined);
  useEffect(() => {
    const updateTableName = (a1Context: string) => {
      if (!codeCell?.sheetId) return;
      const tableName = getTableNameFromPos(a1Context, codeCell.sheetId, codeCell.pos.x, codeCell.pos.y);
      setTableName(tableName);
    };

    updateTableName(sheets.a1Context);

    events.on('a1Context', updateTableName);
    return () => {
      events.off('a1Context', updateTableName);
    };
  }, [codeCell?.pos.x, codeCell?.pos.y, codeCell?.sheetId]);

  if (!codeCell) {
    return null;
  }

  return <ContextPill key="codeCell" primary={tableName ?? 'Untitled'} secondary="Code" disabled={true} />;
});
