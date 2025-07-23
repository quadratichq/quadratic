import { SelectAIModelMenu } from '@/app/ai/components/SelectAIModelMenu';
import { focusGrid } from '@/app/helpers/focusGrid';
import { KeyboardSymbols } from '@/app/helpers/keyboardSymbols';
import { AIContext } from '@/app/ui/components/AIContext';
import { AIUsageExceeded } from '@/app/ui/components/AIUsageExceeded';
import { AIUserMessageFormAttachFileButton } from '@/app/ui/components/AIUserMessageFormAttachFileButton';
import ConditionalWrapper from '@/app/ui/components/ConditionalWrapper';
import { ArrowUpwardIcon, BackspaceIcon, EditIcon } from '@/shared/components/Icons';
import { Button } from '@/shared/shadcn/ui/button';
import { Textarea } from '@/shared/shadcn/ui/textarea';
import { TooltipPopover } from '@/shared/shadcn/ui/tooltip';
import { cn } from '@/shared/shadcn/utils';
import { isSupportedMimeType } from 'quadratic-shared/ai/helpers/files.helper';
import { isContentText } from 'quadratic-shared/ai/helpers/message.helper';
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
import { type SetterOrUpdater } from 'recoil';

export type AIUserMessageFormWrapperProps = {
  textareaRef: React.RefObject<HTMLTextAreaElement | null>;
  autoFocusRef?: React.RefObject<boolean>;
  initialContent?: Content;
  messageIndex: number;
};

export type SubmitPromptArgs = {
  content: Content;
};

type AIUserMessageFormProps = AIUserMessageFormWrapperProps & {
  abortController: AbortController | undefined;
  loading: boolean;
  setLoading: SetterOrUpdater<boolean>;
  submitPrompt: (args: SubmitPromptArgs) => void;
  isFileSupported: (mimeType: string) => boolean;
  fileTypes: string[];
  formOnKeyDown?: (event: React.KeyboardEvent<HTMLTextAreaElement>) => void;
  maxHeight?: string;
  ctx: {
    context: Context;
    setContext?: React.Dispatch<React.SetStateAction<Context>>;
    initialContext?: Context;
  };
  waitingOnMessageIndex?: number;
};
export const AIUserMessageForm = memo(
  forwardRef<HTMLTextAreaElement, AIUserMessageFormProps>((props: AIUserMessageFormProps, ref) => {
    const {
      initialContent,
      ctx,
      waitingOnMessageIndex,
      autoFocusRef,
      textareaRef: bottomTextareaRef,
      abortController,
      loading,
      setLoading,
      isFileSupported,
      fileTypes,
      submitPrompt,
      formOnKeyDown,
      maxHeight = '120px',
    } = props;
    const [editing, setEditing] = useState(!initialContent?.length);
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

    const [files, setFiles] = useState<FileContent[]>([]);
    const [prompt, setPrompt] = useState<string>('');
    useEffect(() => {
      setFiles(initialContent?.filter((item) => item.type === 'data') ?? []);
      setPrompt(
        initialContent
          ?.filter((item) => isContentText(item))
          .map((item) => item.text)
          .join('\n') ?? ''
      );
    }, [initialContent]);

    const showAIUsageExceeded = useMemo(
      () => waitingOnMessageIndex === props.messageIndex,
      [props.messageIndex, waitingOnMessageIndex]
    );

    const handleClickForm = useCallback(() => {
      if (editing) {
        textareaRef.current?.focus();
      }
    }, [editing]);

    const submit = useCallback(
      (prompt: string) => {
        if (prompt.trim().length === 0) return;

        if (initialContent === undefined) {
          setPrompt('');
          setFiles([]);
        }

        submitPrompt({
          content: [...files, { type: 'text', text: prompt }],
        });
      },
      [files, initialContent, submitPrompt]
    );

    const abortPrompt = useCallback(() => {
      abortController?.abort();
      setLoading(false);
    }, [abortController, setLoading]);

    const handleChange = useCallback((event: React.ChangeEvent<HTMLTextAreaElement>) => {
      setPrompt(event.target.value);
    }, []);

    const handleKeyDown = useCallback(
      (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
        event.stopPropagation();

        if (event.key === 'Enter' && !(event.ctrlKey || event.shiftKey)) {
          event.preventDefault();
          if (loading || waitingOnMessageIndex !== undefined) return;

          submit(prompt);

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
      [bottomTextareaRef, formOnKeyDown, initialContent, loading, prompt, submit, waitingOnMessageIndex]
    );

    const handleFiles = useCallback(
      (files: FileList | File[]) => {
        if (files && files.length > 0) {
          for (const file of files) {
            const mimeType = file.type;
            if (isSupportedMimeType(mimeType) && isFileSupported(mimeType)) {
              const reader = new FileReader();
              reader.onloadend = (e) => {
                const dataUrl = e.target?.result as string;
                const base64 = dataUrl.split(',')[1];
                setFiles((prev) => [...prev, { type: 'data', data: base64, mimeType, fileName: file.name }]);
              };
              reader.readAsDataURL(file);
            }
          }
        }
      },
      [isFileSupported]
    );

    const handlePasteOrDrop = useCallback(
      (e: ClipboardEvent<HTMLFormElement> | DragEvent<HTMLFormElement> | DragEvent<HTMLDivElement>) => {
        const filesToHandle =
          'clipboardData' in e ? e.clipboardData.files : 'dataTransfer' in e ? e.dataTransfer.files : null;
        setDragOver(false);
        if (editing && filesToHandle && filesToHandle.length > 0) {
          e.preventDefault();
          e.stopPropagation();
          handleFiles(filesToHandle);
        }
      },
      [editing, handleFiles]
    );

    const handleDrag = useCallback(
      (e: DragEvent<HTMLFormElement | HTMLDivElement>) => {
        e.preventDefault();
        e.stopPropagation();
        setDragOver(editing && e.type !== 'dragleave');
      },
      [editing]
    );

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

    const disabled = useMemo(() => waitingOnMessageIndex !== undefined || !editing, [waitingOnMessageIndex, editing]);

    return (
      <form
        className={cn(
          'group relative h-min rounded-lg border border-accent bg-accent pt-1.5 has-[:focus]:border-primary',
          editing ? '' : 'select-none'
        )}
        onSubmit={(e) => e.preventDefault()}
        onClick={handleClickForm}
        onPaste={handlePasteOrDrop}
        onDrop={handlePasteOrDrop}
        onDragEnter={handleDrag}
        onDragOver={handleDrag}
      >
        {editing && dragOver && (
          <div
            className="absolute bottom-[-2px] left-[-2px] right-[-2px] top-[-2px] z-20 flex flex-col items-center justify-center rounded bg-background opacity-90"
            onDrop={handlePasteOrDrop}
            onDragLeave={handleDrag}
          >
            <div className="absolute bottom-2 left-2 right-2 top-2 z-20 rounded-md border-4 border-dashed border-primary" />
            <div className="pointer-events-none relative z-10 flex select-none flex-col items-center justify-center rounded-lg p-4">
              <span className="text-sm font-bold">Drop files here</span>
              <span className="pl-4 pr-4 text-center text-xs text-muted-foreground">{dragOverMessage}</span>
            </div>
          </div>
        )}

        <EditButton
          show={!editing && !loading && waitingOnMessageIndex === undefined}
          loading={loading}
          setEditing={setEditing}
          textareaRef={textareaRef}
        />

        <AIContext
          initialContext={ctx.initialContext}
          context={ctx.context}
          setContext={ctx.setContext}
          files={files}
          setFiles={setFiles}
          editing={editing}
          isFileSupported={isFileSupported}
          disabled={disabled}
          textareaRef={textareaRef}
        />

        <Textarea
          ref={textareaRef}
          value={prompt}
          className={cn(
            'rounded-none border-none p-2 pb-0 shadow-none focus-visible:ring-0',
            editing ? 'min-h-14' : 'pointer-events-none !max-h-none overflow-hidden',
            (waitingOnMessageIndex !== undefined || showAIUsageExceeded) && 'pointer-events-none opacity-50'
          )}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          autoComplete="off"
          placeholder={waitingOnMessageIndex !== undefined ? 'Waiting to send message...' : 'Ask a question...'}
          autoHeight={true}
          maxHeight={maxHeight}
          disabled={waitingOnMessageIndex !== undefined}
        />

        <AIUsageExceeded show={showAIUsageExceeded} />

        <AIUserMessageFormFooter
          show={editing}
          loading={loading}
          waitingOnMessageIndex={waitingOnMessageIndex}
          textareaRef={textareaRef}
          prompt={prompt}
          submitPrompt={() => submit(prompt)}
          abortPrompt={abortPrompt}
          disabled={disabled}
          handleFiles={handleFiles}
          fileTypes={fileTypes}
        />
      </form>
    );
  })
);

type EditButtonProps = {
  show: boolean;
  loading: boolean;
  setEditing: (editing: boolean) => void;
  textareaRef: React.RefObject<HTMLTextAreaElement | null>;
};
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

type CancelButtonProps = {
  show: boolean;
  abortPrompt: () => void;
};
const CancelButton = memo(({ show, abortPrompt }: CancelButtonProps) => {
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
    >
      <BackspaceIcon className="mr-1" /> Cancel generating
    </Button>
  );
});

type AIUserMessageFormFooterProps = {
  disabled: boolean;
  show: boolean;
  loading: boolean;
  waitingOnMessageIndex?: number;
  textareaRef: React.RefObject<HTMLTextAreaElement | null>;
  prompt: string;
  submitPrompt: () => void;
  abortPrompt: () => void;
  handleFiles: (files: FileList | File[]) => void;
  fileTypes: string[];
};
const AIUserMessageFormFooter = memo(
  ({
    show,
    loading,
    waitingOnMessageIndex,
    textareaRef,
    prompt,
    submitPrompt,
    abortPrompt,
    disabled,
    handleFiles,
    fileTypes,
  }: AIUserMessageFormFooterProps) => {
    if (!show) {
      return null;
    }

    return (
      <>
        <div
          className={cn(
            'flex w-full select-none items-center justify-between px-2 pb-1 text-xs text-muted-foreground',
            waitingOnMessageIndex !== undefined && 'pointer-events-none opacity-50'
          )}
        >
          <AIUserMessageFormAttachFileButton disabled={disabled} handleFiles={handleFiles} fileTypes={fileTypes} />

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
              <Button
                size="icon-sm"
                className="rounded-full"
                onClick={(e) => {
                  e.stopPropagation();
                  submitPrompt();
                }}
                disabled={prompt.length === 0 || loading || waitingOnMessageIndex !== undefined}
              >
                <ArrowUpwardIcon />
              </Button>
            </ConditionalWrapper>
          </div>
        </div>

        <CancelButton show={loading} abortPrompt={abortPrompt} />
      </>
    );
  }
);
