import { SelectAIModelMenu } from '@/app/ai/components/SelectAIModelMenu';
import { debug } from '@/app/debugFlags';
import { KeyboardSymbols } from '@/app/helpers/keyboardSymbols';
import { AIContext } from '@/app/ui/components/AIContext';
import { AIUsageExceeded } from '@/app/ui/components/AIUsageExceeded';
import ConditionalWrapper from '@/app/ui/components/ConditionalWrapper';
import { ArrowUpwardIcon, BackspaceIcon, EditIcon } from '@/shared/components/Icons';
import { Button } from '@/shared/shadcn/ui/button';
import { Textarea } from '@/shared/shadcn/ui/textarea';
import { TooltipPopover } from '@/shared/shadcn/ui/tooltip';
import { cn } from '@/shared/shadcn/utils';
import { isSupportedMimeType } from 'quadratic-shared/ai/helpers/files.helper';
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
import type { SetterOrUpdater } from 'recoil';

export type AIUserMessageFormWrapperProps = {
  textareaRef: React.RefObject<HTMLTextAreaElement>;
  autoFocusRef?: React.RefObject<boolean>;
  initialContent?: Content;
  messageIndex: number;
};

export type SubmitPromptArgs = {
  content: Content;
  onSubmit?: () => void;
};

type AIUserMessageFormProps = AIUserMessageFormWrapperProps & {
  abortController: AbortController | undefined;
  loading: boolean;
  setLoading: SetterOrUpdater<boolean>;
  submitPrompt: (args: SubmitPromptArgs) => void;
  isFileSupported: (mimeType: string) => boolean;
  formOnKeyDown?: (event: React.KeyboardEvent<HTMLTextAreaElement>) => void;
  maxHeight?: string;
  ctx?: {
    context: Context;
    setContext: React.Dispatch<React.SetStateAction<Context>>;
    initialContext?: Context;
  };
  waitingOnMessageIndex?: number;
  delaySeconds?: number;
};

export const AIUserMessageForm = memo(
  forwardRef<HTMLTextAreaElement, AIUserMessageFormProps>((props: AIUserMessageFormProps, ref) => {
    const {
      initialContent,
      ctx,
      waitingOnMessageIndex,
      delaySeconds,
      autoFocusRef,
      textareaRef: bottomTextareaRef,
      abortController,
      loading,
      setLoading,
      isFileSupported,
      submitPrompt,
      formOnKeyDown,
      maxHeight = '120px',
    } = props;
    const [editing, setEditing] = useState(!initialContent?.length);

    const initialFiles = useMemo(() => initialContent?.filter((item) => item.type === 'data'), [initialContent]);
    const [files, setFiles] = useState<FileContent[]>(initialFiles ?? []);

    const initialPrompt = useMemo(
      () =>
        initialContent
          ?.filter((item) => item.type === 'text')
          .map((item) => item.text)
          .join('\n'),
      [initialContent]
    );
    const [prompt, setPrompt] = useState<string>(initialPrompt ?? '');

    const onSubmit = useCallback(() => {
      if (initialPrompt === undefined) {
        setPrompt('');
        setFiles([]);
      }
    }, [initialPrompt]);

    const submit = useCallback(() => {
      submitPrompt({
        content: [...files, { type: 'text', text: prompt }],
        onSubmit: initialPrompt === undefined ? onSubmit : undefined,
      });
    }, [files, initialPrompt, onSubmit, prompt, submitPrompt]);

    const abortPrompt = useCallback(() => {
      abortController?.abort();
      setLoading(false);
    }, [abortController, setLoading]);

    const handleFiles = useCallback(
      (files: FileList | null) => {
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
      (e: ClipboardEvent<HTMLFormElement> | DragEvent<HTMLFormElement>) => {
        const filesToHandle =
          'clipboardData' in e ? e.clipboardData.files : 'dataTransfer' in e ? e.dataTransfer.files : null;
        if (filesToHandle && filesToHandle.length > 0) {
          e.preventDefault();
          handleFiles(filesToHandle);
        }
      },
      [handleFiles]
    );

    const textareaRef = useRef<HTMLTextAreaElement>(null);
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

    return (
      <form
        className={cn('group relative h-min rounded-lg bg-accent pt-1.5', editing ? '' : 'select-none')}
        onSubmit={(e) => e.preventDefault()}
        onClick={() => {
          if (editing) {
            textareaRef.current?.focus();
          }
        }}
        onPaste={handlePasteOrDrop}
        onDrop={handlePasteOrDrop}
      >
        {!editing && !loading && waitingOnMessageIndex === undefined && (
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
        )}

        <AIContext
          initialContext={ctx?.initialContext}
          context={ctx?.context}
          setContext={ctx?.setContext}
          files={files}
          setFiles={setFiles}
          handleFiles={handleFiles}
          editing={editing}
          disabled={waitingOnMessageIndex !== undefined || !editing}
          textAreaRef={textareaRef}
        />

        {editing ? (
          <>
            <Textarea
              ref={textareaRef}
              value={prompt}
              className={cn(
                'rounded-none border-none p-2 pb-0 shadow-none focus-visible:ring-0',
                editing ? 'min-h-14' : 'pointer-events-none h-fit min-h-fit',
                waitingOnMessageIndex !== undefined && 'pointer-events-none opacity-50'
              )}
              onChange={(event) => setPrompt(event.target.value)}
              onKeyDown={(event) => {
                event.stopPropagation();

                if (event.key === 'Enter' && !(event.ctrlKey || event.shiftKey)) {
                  event.preventDefault();
                  if (loading || waitingOnMessageIndex !== undefined) return;

                  if (prompt.trim().length === 0) return;

                  submit();

                  if (initialPrompt === undefined) {
                    textareaRef.current?.focus();
                  } else {
                    setEditing(false);
                    bottomTextareaRef.current?.focus();
                  }
                }

                if (loading || waitingOnMessageIndex !== undefined) return;

                if (formOnKeyDown) {
                  formOnKeyDown(event);
                }
              }}
              autoComplete="off"
              placeholder={waitingOnMessageIndex !== undefined ? 'Waiting to send message...' : 'Ask a question...'}
              autoHeight={true}
              maxHeight={maxHeight}
              disabled={waitingOnMessageIndex !== undefined}
            />

            {waitingOnMessageIndex === props.messageIndex && <AIUsageExceeded delaySeconds={delaySeconds ?? 0} />}
          </>
        ) : (
          <>
            <div
              className={cn(
                'pointer-events-none whitespace-pre-wrap p-2 text-sm',
                waitingOnMessageIndex === props.messageIndex && 'opacity-50'
              )}
            >
              {prompt}
            </div>

            {waitingOnMessageIndex === props.messageIndex && <AIUsageExceeded delaySeconds={delaySeconds ?? 0} />}
          </>
        )}

        {editing && (
          <>
            <div
              className={cn(
                'flex w-full select-none items-center justify-between px-2 pb-1',
                waitingOnMessageIndex !== undefined && 'pointer-events-none opacity-50'
              )}
            >
              <SelectAIModelMenu loading={loading} textAreaRef={textareaRef} />

              <div className="flex items-center gap-3 text-xs text-muted-foreground">
                {!debug && (
                  <>
                    <span>
                      {KeyboardSymbols.Shift}
                      {KeyboardSymbols.Enter} new line
                    </span>

                    <span>{KeyboardSymbols.Enter} submit</span>
                  </>
                )}

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
                      submit();
                    }}
                    disabled={prompt.length === 0 || loading || waitingOnMessageIndex !== undefined}
                  >
                    <ArrowUpwardIcon />
                  </Button>
                </ConditionalWrapper>
              </div>
            </div>

            {(loading || waitingOnMessageIndex !== undefined) && (
              <Button
                size="sm"
                variant="outline"
                className="absolute -top-10 right-1/2 z-10 translate-x-1/2 bg-background"
                onClick={(e) => {
                  e.stopPropagation();
                  abortPrompt();
                }}
              >
                <BackspaceIcon className="mr-1" /> Cancel{' '}
                {waitingOnMessageIndex !== undefined ? 'sending' : 'generating'}
              </Button>
            )}
          </>
        )}
      </form>
    );
  })
);
