import type { ImportFile } from '@/app/ai/hooks/useImportFilesToGrid';
import { activeSchemaConnectionUuidAtom, loadingAtom } from '@/app/ai/atoms/aiAnalystAtoms';
import { events } from '@/app/events/events';
import { sheets } from '@/app/grid/controller/Sheets';
import { getFileTypeFromName } from '@/app/helpers/files';
import type { CodeCell } from '@/app/shared/types/codeCell';
import { useConnectionsFetcher } from '@/app/ui/hooks/useConnectionsFetcher';
import { ConnectionIcon } from '@/shared/components/ConnectionIcon';
import { CloseIcon } from '@/shared/components/Icons';
import { Button } from '@/shared/shadcn/ui/button';
import { HoverCard, HoverCardContent, HoverCardTrigger } from '@/shared/shadcn/ui/hover-card';
import { cn } from '@/shared/shadcn/utils';
import { useAtom, useAtomValue } from 'jotai';
import {
  getDataBase64String,
  getFileTypeLabel,
  isSupportedImageMimeType,
} from 'quadratic-shared/ai/helpers/files.helper';
import type { Context, FileContent } from 'quadratic-shared/typesAndSchemasAI';
import { memo, useCallback, useEffect, useState } from 'react';

interface AIContextProps {
  context: Context;
  setContext?: React.Dispatch<React.SetStateAction<Context>>;
  files: FileContent[];
  setFiles: (files: FileContent[]) => void;
  importFiles: ImportFile[];
  setImportFiles: (importFiles: ImportFile[]) => void;
  disabled: boolean;
  textareaRef: React.RefObject<HTMLTextAreaElement | null>;
}
export const AIContext = memo(
  ({ context, setContext, files, setFiles, importFiles, setImportFiles, disabled, textareaRef }: AIContextProps) => {
    const loading = useAtomValue(loadingAtom);
    const { connections } = useConnectionsFetcher();
    const [, setAIAnalystActiveSchemaConnectionUuid] = useAtom(activeSchemaConnectionUuidAtom);

    const handleOnClickConnection = useCallback(() => {
      setAIAnalystActiveSchemaConnectionUuid(undefined);
      setContext?.((prev) => ({ ...prev, connection: undefined }));
      textareaRef.current?.focus();
    }, [setContext, textareaRef, setAIAnalystActiveSchemaConnectionUuid]);

    const handleOnClickFileContext = useCallback(
      (index: number) => {
        setFiles(files.filter((_, i) => i !== index));
        textareaRef.current?.focus();
      },
      [files, setFiles, textareaRef]
    );

    const handleOnClickImportFileContext = useCallback(
      (index: number) => {
        setImportFiles(importFiles.filter((_, i) => i !== index));
        textareaRef.current?.focus();
      },
      [importFiles, setImportFiles, textareaRef]
    );

    return (
      <div
        className={cn(
          `z-10 flex select-none flex-wrap items-center gap-1 px-2 text-xs`,
          disabled && 'select-none opacity-60',
          loading && 'select-none opacity-60'
        )}
      >
        {connections
          .filter((connection) => context.connection?.id === connection.uuid)
          .map((connection) => (
            <ContextPill
              key={connection.uuid}
              primary={connection.name}
              primaryIcon={<ConnectionIcon type={connection.type} className="h-3 w-3" />}
              secondary={''}
              onRemove={handleOnClickConnection}
              onClick={() => {
                setAIAnalystActiveSchemaConnectionUuid((prevUuid) => {
                  return prevUuid && prevUuid === connection.uuid ? undefined : connection.uuid;
                });
                textareaRef.current?.focus();
              }}
              disabled={disabled}
            />
          ))}

        {files.map((file, index) => (
          <FileContextPill
            key={`${index}-${file.fileName}`}
            disabled={disabled}
            file={file}
            onRemove={() => handleOnClickFileContext(index)}
          />
        ))}

        {importFiles.map((file, index) => (
          <ContextPill
            key={`${index}-${file.name}`}
            primary={file.name}
            secondary={getFileTypeFromName(file.name) ?? 'Unknown'}
            disabled={disabled}
            onRemove={() => handleOnClickImportFileContext(index)}
          />
        ))}

        {context.importFiles?.files.map((file, index) => (
          <ContextPill
            key={`${index}-${file.name}`}
            primary={file.name}
            secondary={getFileTypeFromName(file.name) ?? 'Unknown'}
            disabled={disabled}
          />
        ))}

        <CodeCellContextPill codeCell={context.codeCell} />
      </div>
    );
  }
);

interface ContextPillProps {
  primary: string;
  primaryIcon?: React.ReactNode;
  secondary: string;
  onRemove?: () => void;
  disabled?: boolean;
  onClick?: () => void;
}
const ContextPill = memo(({ disabled, primary, primaryIcon, secondary, onRemove, onClick }: ContextPillProps) => {
  const Tag = onClick ? 'button' : 'div';
  return (
    <Tag
      className={cn(
        'flex h-5 items-center self-stretch rounded border border-border px-1 text-xs',
        onClick && !disabled && 'cursor-pointer'
      )}
      {...(onClick && { onClick, disabled })}
    >
      <span className="flex items-center gap-1">
        {primaryIcon}
        <span className="max-w-48 truncate">{primary}</span>
      </span>

      <span className="ml-0.5 text-muted-foreground">{secondary}</span>

      {!disabled && onRemove && (
        <Button
          size="icon-sm"
          className="-mr-0.5 ml-0 h-4 w-4 items-center shadow-none"
          variant="ghost"
          onClick={(e) => {
            e.stopPropagation();
            onRemove();
          }}
        >
          <CloseIcon className="!h-4 !w-4 !text-xs" />
        </Button>
      )}
    </Tag>
  );
});

interface FileContextPillProps {
  disabled: boolean;
  file: FileContent;
  onRemove: () => void;
}
const FileContextPill = memo(({ disabled, file, onRemove }: FileContextPillProps) => {
  return (
    <HoverCard open={isSupportedImageMimeType(file.mimeType) ? undefined : false}>
      <HoverCardTrigger>
        <ContextPill
          primary={file.fileName}
          secondary={getFileTypeLabel(file.mimeType)}
          disabled={disabled}
          onRemove={onRemove}
        />
      </HoverCardTrigger>
      <HoverCardContent className="w-48 overflow-hidden p-0" side="top">
        <img src={getDataBase64String(file)} alt={file.fileName} />
        <span className="block border-t border-border px-1 py-0.5 text-xs">{file.fileName}</span>
      </HoverCardContent>
    </HoverCard>
  );
});

interface CodeCellContextPillProps {
  codeCell: CodeCell | undefined;
}
const CodeCellContextPill = memo(({ codeCell }: CodeCellContextPillProps) => {
  const [tableName, setTableName] = useState<string | undefined>(undefined);
  useEffect(() => {
    const updateTableName = () => {
      if (!codeCell?.sheetId) return;
      const tableName = sheets.sheet.cursor.getTableNameFromPos(codeCell);
      setTableName(tableName);
    };

    updateTableName();

    events.on('a1ContextUpdated', updateTableName);
    return () => {
      events.off('a1ContextUpdated', updateTableName);
    };
  }, [codeCell]);

  if (!codeCell) {
    return null;
  }

  return <ContextPill key="codeCell" primary={tableName ?? 'Untitled'} secondary="Code" disabled={true} />;
});
