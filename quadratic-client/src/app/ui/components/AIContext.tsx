import {
  aiAnalystCurrentChatMessagesAtom,
  aiAnalystCurrentChatMessagesCountAtom,
  aiAnalystLoadingAtom,
} from '@/app/atoms/aiAnalystAtom';
import { events } from '@/app/events/events';
import { sheets } from '@/app/grid/controller/Sheets';
import { getCodeCell } from '@/app/helpers/codeCellLanguage';
import type { CodeCell } from '@/app/shared/types/codeCell';
import { defaultAIAnalystContext } from '@/app/ui/menus/AIAnalyst/const/defaultAIAnalystContext';
import { CloseIcon } from '@/shared/components/Icons';
import { LanguageIcon } from '@/shared/components/LanguageIcon';
import { Button } from '@/shared/shadcn/ui/button';
import { HoverCard, HoverCardContent, HoverCardTrigger } from '@/shared/shadcn/ui/hover-card';
import { cn } from '@/shared/shadcn/utils';
import {
  getDataBase64String,
  getFileTypeLabel,
  isSupportedImageMimeType,
} from 'quadratic-shared/ai/helpers/files.helper';
import { getUserPromptMessages } from 'quadratic-shared/ai/helpers/message.helper';
import type { Context, FileContent } from 'quadratic-shared/typesAndSchemasAI';
import { memo, useCallback, useEffect, useState } from 'react';
import { useRecoilValue } from 'recoil';

type AIContextProps = {
  initialContext?: Context;
  context: Context;
  setContext?: React.Dispatch<React.SetStateAction<Context>>;
  files: FileContent[];
  setFiles: (files: FileContent[]) => void;
  isFileSupported: (mimeType: string) => boolean;
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
    isFileSupported,
    editing,
    disabled,
    textareaRef,
  }: AIContextProps) => {
    const loading = useRecoilValue(aiAnalystLoadingAtom);
    const messages = useRecoilValue(aiAnalystCurrentChatMessagesAtom);
    const messagesCount = useRecoilValue(aiAnalystCurrentChatMessagesCountAtom);
    const [, setCurrentSheet] = useState(sheets.sheet.name);

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
        const lastUserMessage = getUserPromptMessages(messages).at(-1);
        if (lastUserMessage) {
          setContext(lastUserMessage.context ?? defaultAIAnalystContext);
        }
      }
    }, [initialContext, loading, messages, messagesCount, setContext]);

    const handleOnClickFileContext = useCallback(
      (file: FileContent) => {
        setFiles(files.filter((f) => f !== file));
      },
      [files, setFiles]
    );

    const handleOnClickConnection = useCallback(
      (connectionUuid: string) => {
        setContext?.((prev) => ({
          ...prev,
          connections: prev.connections?.filter((c) => c.uuid !== connectionUuid),
        }));
      },
      [setContext]
    );

    // const handleOnClickSelection = useCallback(() => {
    //   setContext?.((prev) => ({ ...prev, selection: undefined }));
    // }, [setContext]);

    return (
      <div
        className={cn(
          `z-10 flex select-none flex-wrap items-center gap-1 px-2 text-xs`,
          disabled && 'select-none opacity-60',
          loading && 'select-none opacity-60'
        )}
      >
        {context &&
          setContext &&
          context.connections &&
          context.connections.map((connection) => (
            <ContextPill
              key={connection.uuid}
              primary={connection.name}
              primaryIcon={<LanguageIcon language={connection.type} className="h-3 w-3" />}
              // TODO: fix types
              // @ts-ignore
              secondary={getCodeCell(connection.type)?.label ?? 'Connection'}
              onClick={() => handleOnClickConnection(connection.uuid)}
              noClose={false}
            />
          ))}
        {files
          .filter((file) => isFileSupported(file.mimeType))
          .map((file, index) => (
            <FileContextPill
              key={`${index}-${file.fileName}`}
              disabled={disabled}
              file={file}
              onClick={() => handleOnClickFileContext(file)}
            />
          ))}

        <CodeCellContextPill codeCell={context.codeCell} />
      </div>
    );
  }
);

type ContextPillProps = {
  primary: string;
  primaryIcon?: React.ReactNode;
  secondary: string;
  onClick?: () => void;
  noClose: boolean;
};
const ContextPill = memo(({ primary, primaryIcon, secondary, onClick, noClose }: ContextPillProps) => {
  return (
    <div className="flex h-5 items-center self-stretch rounded border border-border px-1 text-xs">
      <span className="flex items-center gap-1">
        {primaryIcon}
        <span className="max-w-24 truncate">{primary}</span>
      </span>

      <span className="ml-0.5 text-muted-foreground">{secondary}</span>

      {!noClose && (
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
          noClose={disabled}
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

type CodeCellContextPillProps = {
  codeCell: CodeCell | undefined;
};
const CodeCellContextPill = memo(({ codeCell }: CodeCellContextPillProps) => {
  const [tableName, setTableName] = useState<string | undefined>(undefined);
  useEffect(() => {
    const updateTableName = () => {
      if (!codeCell?.sheetId) return;
      const tableName = sheets.sheet.cursor.jsSelection.getTableNameFromPos(
        codeCell.sheetId,
        codeCell.pos.x,
        codeCell.pos.y,
        sheets.jsA1Context
      );
      setTableName(tableName);
    };

    updateTableName();

    events.on('a1ContextUpdated', updateTableName);
    return () => {
      events.off('a1ContextUpdated', updateTableName);
    };
  }, [codeCell?.pos.x, codeCell?.pos.y, codeCell?.sheetId]);

  if (!codeCell) {
    return null;
  }

  return <ContextPill key="codeCell" primary={tableName ?? 'Untitled'} secondary="Code" noClose={true} />;
});
