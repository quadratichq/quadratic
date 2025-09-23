import { SelectAIModelMenu } from '@/app/ai/components/SelectAIModelMenu';
import { type ImportFile } from '@/app/ai/hooks/useImportFilesToGrid';
import { aiAnalystCurrentChatMessagesCountAtom } from '@/app/atoms/aiAnalystAtom';
import { events } from '@/app/events/events';
import { getExtension } from '@/app/helpers/files';
import { focusGrid } from '@/app/helpers/focusGrid';
import { KeyboardSymbols } from '@/app/helpers/keyboardSymbols';
import { AIContext } from '@/app/ui/components/AIContext';
import { AIUsageExceeded } from '@/app/ui/components/AIUsageExceeded';
import { AIUserMessageFormAttachFileButton } from '@/app/ui/components/AIUserMessageFormAttachFileButton';
import { AIUserMessageFormConnectionsButton } from '@/app/ui/components/AIUserMessageFormConnectionsButton';
import ConditionalWrapper from '@/app/ui/components/ConditionalWrapper';
import { AIAnalystPromptSuggestions } from '@/app/ui/menus/AIAnalyst/AIAnalystPromptSuggestions';
import { ArrowUpwardIcon, BackspaceIcon, EditIcon } from '@/shared/components/Icons';
import { Button } from '@/shared/shadcn/ui/button';
import { Textarea } from '@/shared/shadcn/ui/textarea';
import { TooltipPopover } from '@/shared/shadcn/ui/tooltip';
import { cn } from '@/shared/shadcn/utils';
import { isSupportedMimeType } from 'quadratic-shared/ai/helpers/files.helper';
import { createTextContent, isContentFile, isContentText } from 'quadratic-shared/ai/helpers/message.helper';
import type { Content, Context, FileContent } from 'quadratic-shared/typesAndSchemasAI';
import {
  forwardRef,
  memo,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
  type ClipboardEvent,
  type DragEvent,
} from 'react';
import { useRecoilValue, type SetterOrUpdater } from 'recoil';

export interface AIUserMessageFormWrapperProps {
  textareaRef: React.RefObject<HTMLTextAreaElement | null>;
  autoFocusRef?: React.RefObject<boolean>;
  initialContent?: Content;
  initialContext?: Context;
  messageIndex: number;
  onContentChange?: (content: Content) => void;
  showPromptSuggestions?: boolean;
}

export interface SubmitPromptArgs {
  content: Content;
  context: Context;
  importFiles: ImportFile[];
}

interface AIUserMessageFormProps extends AIUserMessageFormWrapperProps {
  abortController: AbortController | undefined;
  loading: boolean;
  setLoading: SetterOrUpdater<boolean>;
  cancelDisabled: boolean;
  context: Context;
  setContext?: React.Dispatch<React.SetStateAction<Context>>;
  submitPrompt: (args: SubmitPromptArgs) => void;
  isChatFileSupported: (mimeType: string) => boolean;
  isImportFileSupported: (extension: string) => boolean;
  fileTypes: string[];
  formOnKeyDown?: (event: React.KeyboardEvent<HTMLTextAreaElement>) => void;
  maxHeight?: string;
  waitingOnMessageIndex?: number;
}
export const AIUserMessageForm = memo(
  forwardRef<HTMLTextAreaElement, AIUserMessageFormProps>((props: AIUserMessageFormProps, ref) => {
    const {
      textareaRef: bottomTextareaRef,
      autoFocusRef,
      initialContent,
      initialContext,
      onContentChange,
      waitingOnMessageIndex,
      abortController,
      loading,
      setLoading,
      cancelDisabled,
      context,
      setContext,
      isChatFileSupported,
      isImportFileSupported,
      fileTypes,
      submitPrompt,
      formOnKeyDown,
      maxHeight = '120px',
      showPromptSuggestions,
    } = props;

    const [editing, setEditing] = useState(!initialContent?.length);
    const editingOrDebugEditing = useMemo(() => editing || !!onContentChange, [editing, onContentChange]);

    const [dragOver, setDragOver] = useState(false);
    const dragOverMessage = useMemo(
      () =>
        fileTypes.includes('.pdf') && fileTypes.includes('image/*')
          ? 'PDFs and images supported'
          : fileTypes.includes('.pdf')
            ? 'PDFs supported'
            : fileTypes.includes('image/*')
              ? 'Images supported'
              : 'Files not supported by this model',
      [fileTypes]
    );

    const messagesCount = useRecoilValue(aiAnalystCurrentChatMessagesCountAtom);
    const [files, setFiles] = useState<FileContent[]>([]);
    const [importFiles, setImportFiles] = useState<ImportFile[]>([]);
    const [prompt, setPrompt] = useState<string>('');
    useEffect(() => {
      setFiles(initialContent?.filter((item) => isContentFile(item)) ?? []);
      setImportFiles([]);
      setPrompt(
        initialContent
          ?.filter((item) => isContentText(item))
          .map((item) => item.text)
          .join('\n') ?? ''
      );
      setContext?.(initialContext ?? {});
    }, [initialContent, initialContext, setContext]);

    const showAIUsageExceeded = useMemo(
      () => waitingOnMessageIndex === props.messageIndex,
      [props.messageIndex, waitingOnMessageIndex]
    );

    const handleClickForm = useCallback(() => {
      if (editingOrDebugEditing) {
        textareaRef.current?.focus();
      }
    }, [editingOrDebugEditing]);

    const handleSubmit = useCallback(
      (prompt: string) => {
        const trimmedPrompt = prompt.trim();
        if (trimmedPrompt.length === 0) return;

        submitPrompt({
          content: [...files, createTextContent(trimmedPrompt)],
          context,
          importFiles,
        });

        if (initialContent === undefined) {
          setFiles([]);
          setImportFiles([]);
          setPrompt('');
          setContext?.({});
        }
      },
      [context, files, importFiles, initialContent, setContext, submitPrompt]
    );

    const abortPrompt = useCallback(() => {
      abortController?.abort();
      setLoading(false);
    }, [abortController, setLoading]);

    const handlePromptChange = useCallback(
      (event: React.ChangeEvent<HTMLTextAreaElement>) => {
        setPrompt(event.target.value);
        onContentChange?.([...files, createTextContent(event.target.value)]);
      },
      [files, onContentChange]
    );

    const handleFilesChange = useCallback(
      (newFiles: FileContent[]) => {
        setFiles(newFiles);
        onContentChange?.([...newFiles, createTextContent(prompt)]);
      },
      [onContentChange, prompt]
    );

    const handleKeyDown = useCallback(
      (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
        event.stopPropagation();

        if (event.key === 'Enter' && !(event.ctrlKey || event.shiftKey)) {
          event.preventDefault();
          if (loading || waitingOnMessageIndex !== undefined) return;

          handleSubmit(prompt);

          if (initialContent === undefined) {
            textareaRef.current?.focus();
          } else {
            setEditing(false);
            bottomTextareaRef.current?.focus();
          }
        } else if (event.key === 'Escape') {
          if (initialContent === undefined) {
            focusGrid();
          } else {
            setEditing(false);
            bottomTextareaRef.current?.focus();
          }
        }

        if (loading || waitingOnMessageIndex !== undefined) return;

        if (formOnKeyDown) {
          formOnKeyDown(event);
        }
      },
      [bottomTextareaRef, formOnKeyDown, initialContent, loading, prompt, handleSubmit, waitingOnMessageIndex]
    );

    const handleFiles = useCallback(
      async (newFiles: FileList | File[]) => {
        if (newFiles && newFiles.length > 0) {
          for (const newFile of newFiles) {
            const mimeType = newFile.type;
            const extension = getExtension(newFile.name);
            if (isSupportedMimeType(mimeType) && isChatFileSupported(mimeType)) {
              const reader = new FileReader();
              reader.onloadend = (e) => {
                const dataUrl = e.target?.result as string;
                const base64 = dataUrl.split(',')[1];
                handleFilesChange([...files, { type: 'data', data: base64, mimeType, fileName: newFile.name }]);
              };
              reader.onerror = (e) => {
                console.error('Error reading file', e);
              };
              reader.readAsDataURL(newFile);
            } else if (isImportFileSupported(`.${extension}`)) {
              try {
                const data = await newFile.arrayBuffer();
                setImportFiles((prev) => [...prev, { name: newFile.name, size: newFile.size, data }]);
              } catch (error) {
                console.error('Error reading file', error);
              }
            }
          }
        }
      },
      [files, handleFilesChange, isChatFileSupported, isImportFileSupported]
    );

    const handlePasteOrDrop = useCallback(
      (e: ClipboardEvent<HTMLFormElement> | DragEvent<HTMLFormElement> | DragEvent<HTMLDivElement>) => {
        const filesToHandle =
          'clipboardData' in e ? e.clipboardData.files : 'dataTransfer' in e ? e.dataTransfer.files : null;
        setDragOver(false);
        if (editingOrDebugEditing && filesToHandle && filesToHandle.length > 0) {
          e.preventDefault();
          e.stopPropagation();
          handleFiles(filesToHandle);
        }
      },
      [editingOrDebugEditing, handleFiles]
    );

    const handleDrag = useCallback(
      (e: DragEvent<HTMLFormElement | HTMLDivElement> | DragEvent<HTMLTextAreaElement>) => {
        e.preventDefault();
        e.stopPropagation();
        setDragOver(editingOrDebugEditing && e.type !== 'dragleave');
      },
      [editingOrDebugEditing]
    );

    useEffect(() => {
      if (initialContent === undefined) {
        events.on('aiAnalystDroppedFiles', handleFiles);
      }
      return () => {
        events.off('aiAnalystDroppedFiles', handleFiles);
      };
    }, [handleFiles, initialContent]);

    const textareaRef = useRef<HTMLTextAreaElement | null>(null);
    useImperativeHandle(ref, () => textareaRef.current!);

    // Focus the input when relevant & the tab comes into focus
    useEffect(() => {
      if (autoFocusRef?.current) {
        textareaRef.current?.focus();
      }
    }, [autoFocusRef, textareaRef]);

    useEffect(() => {
      if (loading && initialContent !== undefined) {
        setEditing(false);
      }
    }, [loading, initialContent]);

    const disabled = useMemo(
      () => waitingOnMessageIndex !== undefined || !editingOrDebugEditing,
      [waitingOnMessageIndex, editingOrDebugEditing]
    );

    return (
      <div className="relative">
        {showPromptSuggestions && messagesCount === 0 && (
          <AIAnalystPromptSuggestions
            exampleSet={files.length > 0 ? 'file-pdf' : context.connection ? 'connection' : 'empty'}
            prompt={prompt}
            submit={handleSubmit}
          />
        )}

        <form
          className={cn(
            'group relative h-min rounded-lg border border-accent bg-accent pt-1.5 has-[textarea:focus]:border-primary',
            editingOrDebugEditing ? '' : 'select-none'
          )}
          onSubmit={(e) => e.preventDefault()}
          onClick={handleClickForm}
          onPaste={handlePasteOrDrop}
          onDrop={handlePasteOrDrop}
        >
          {editingOrDebugEditing && dragOver && (
            <div
              className="absolute bottom-2 left-2 right-2 top-2 z-20 flex flex-col items-center justify-center rounded bg-background opacity-90"
              onDrop={handlePasteOrDrop}
              onDragOver={handleDrag}
              onDragLeave={handleDrag}
            >
              <div className="pointer-events-none relative z-10 flex h-full w-full select-none flex-col items-center justify-center rounded-md border-4 border-dashed border-primary p-4">
                <span className="text-sm font-bold">Drop files here</span>
                <span className="pl-4 pr-4 text-center text-xs text-muted-foreground">{dragOverMessage}</span>
              </div>
            </div>
          )}

          <EditButton
            show={!editingOrDebugEditing && !loading && waitingOnMessageIndex === undefined}
            loading={loading}
            setEditing={setEditing}
            textareaRef={textareaRef}
          />

          <AIContext
            context={context}
            setContext={setContext}
            files={files}
            setFiles={handleFilesChange}
            importFiles={importFiles}
            setImportFiles={setImportFiles}
            disabled={disabled}
            textareaRef={textareaRef}
          />

          <Textarea
            ref={textareaRef}
            value={prompt}
            className={cn(
              'rounded-none border-none p-2 pb-0 pt-1 shadow-none focus-visible:ring-0',
              editingOrDebugEditing ? 'min-h-14' : 'pointer-events-none !max-h-none overflow-hidden',
              (waitingOnMessageIndex !== undefined || showAIUsageExceeded) && 'pointer-events-none opacity-50'
            )}
            onChange={handlePromptChange}
            onKeyDown={handleKeyDown}
            autoComplete="off"
            placeholder={waitingOnMessageIndex !== undefined ? 'Waiting to send message...' : 'Ask a question...'}
            autoHeight={true}
            maxHeight={maxHeight}
            disabled={waitingOnMessageIndex !== undefined}
            onDragEnter={handleDrag}
          />

          <AIUsageExceeded show={showAIUsageExceeded} />

          <AIUserMessageFormFooter
            show={editing}
            loading={loading}
            waitingOnMessageIndex={waitingOnMessageIndex}
            textareaRef={textareaRef}
            prompt={prompt}
            submitPrompt={handleSubmit}
            abortPrompt={abortPrompt}
            disabled={disabled}
            cancelDisabled={cancelDisabled}
            handleFiles={handleFiles}
            fileTypes={fileTypes}
            context={context}
            setContext={setContext}
          />
        </form>
      </div>
    );
  })
);

interface EditButtonProps {
  show: boolean;
  loading: boolean;
  setEditing: (editing: boolean) => void;
  textareaRef: React.RefObject<HTMLTextAreaElement | null>;
}
const EditButton = memo(({ show, loading, setEditing, textareaRef }: EditButtonProps) => {
  if (!show) {
    return null;
  }

  return (
    <TooltipPopover label="Edit">
      <Button
        variant="ghost"
        className="pointer-events-auto absolute right-0.5 top-0.5 z-10 bg-accent text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100"
        size="icon-sm"
        onClick={(e) => {
          if (loading) return;
          e.stopPropagation();
          setEditing(true);
          textareaRef.current?.focus();
        }}
      >
        <EditIcon />
      </Button>
    </TooltipPopover>
  );
});

interface CancelButtonProps {
  show: boolean;
  disabled: boolean;
  abortPrompt: () => void;
}
const CancelButton = memo(({ show, disabled, abortPrompt }: CancelButtonProps) => {
  if (!show) {
    return null;
  }

  return (
    <Button
      size="sm"
      variant="outline"
      className="absolute -top-10 right-1/2 z-10 translate-x-1/2 bg-background"
      onClick={(e) => {
        e.stopPropagation();
        abortPrompt();
      }}
      disabled={disabled}
    >
      <BackspaceIcon className="mr-1" /> Cancel generating
    </Button>
  );
});

interface AIUserMessageFormFooterProps {
  disabled: boolean;
  cancelDisabled: boolean;
  show: boolean;
  loading: boolean;
  waitingOnMessageIndex?: number;
  textareaRef: React.RefObject<HTMLTextAreaElement | null>;
  prompt: string;
  submitPrompt: (prompt: string) => void;
  abortPrompt: () => void;
  handleFiles: (files: FileList | File[]) => void;
  fileTypes: string[];
  context: Context;
  setContext?: React.Dispatch<React.SetStateAction<Context>>;
}
const AIUserMessageFormFooter = memo(
  ({
    disabled,
    cancelDisabled,
    show,
    loading,
    waitingOnMessageIndex,
    textareaRef,
    prompt,
    submitPrompt,
    abortPrompt,
    handleFiles,
    fileTypes,
    context,
    setContext,
  }: AIUserMessageFormFooterProps) => {
    const handleClickSubmit = useCallback(
      (e: React.MouseEvent<HTMLButtonElement>) => {
        e.stopPropagation();
        submitPrompt(prompt);
      },
      [submitPrompt, prompt]
    );

    const disabledSubmit = useMemo(
      () => prompt.length === 0 || loading || waitingOnMessageIndex !== undefined,
      [prompt, loading, waitingOnMessageIndex]
    );

    if (!show) {
      return null;
    }

    return (
      <>
        <div
          className={cn(
            'flex w-full select-none items-center justify-between px-2 pb-1 text-xs',
            waitingOnMessageIndex !== undefined && 'pointer-events-none opacity-50'
          )}
        >
          <div className="flex items-center gap-1">
            <AIUserMessageFormAttachFileButton disabled={disabled} handleFiles={handleFiles} fileTypes={fileTypes} />

            <AIUserMessageFormConnectionsButton
              disabled={disabled}
              context={context}
              setContext={setContext}
              textareaRef={textareaRef}
            />
          </div>

          <div className="flex items-center gap-1 text-muted-foreground">
            <SelectAIModelMenu loading={loading} textareaRef={textareaRef} />

            <div className="flex items-center gap-3">
              <ConditionalWrapper
                condition={prompt.length !== 0}
                Wrapper={({ children }) => (
                  <TooltipPopover label="Submit" shortcut={`${KeyboardSymbols.Enter}`}>
                    {children as React.ReactElement}
                  </TooltipPopover>
                )}
              >
                <Button size="icon-sm" className="rounded-full" onClick={handleClickSubmit} disabled={disabledSubmit}>
                  <ArrowUpwardIcon />
                </Button>
              </ConditionalWrapper>
            </div>
          </div>
        </div>

        <CancelButton show={loading} disabled={cancelDisabled} abortPrompt={abortPrompt} />
      </>
    );
  }
);
