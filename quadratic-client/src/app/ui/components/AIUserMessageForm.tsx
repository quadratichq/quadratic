import { SelectAIModelMenu } from '@/app/ai/components/SelectAIModelMenu';
import {
  editorInteractionStateSettingsAtom,
  editorInteractionStateTeamUuidAtom,
} from '@/app/atoms/editorInteractionStateAtom';
import { debug } from '@/app/debugFlags';
import { KeyboardSymbols } from '@/app/helpers/keyboardSymbols';
import ConditionalWrapper from '@/app/ui/components/ConditionalWrapper';
import { AIAnalystContext } from '@/app/ui/menus/AIAnalyst/AIAnalystContext';
import { ArrowUpwardIcon, BackspaceIcon, EditIcon } from '@/shared/components/Icons';
import { ROUTES } from '@/shared/constants/routes';
import { DOCUMENTATION_ANALYTICS_AI } from '@/shared/constants/urls';
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
import { useRecoilValue } from 'recoil';

export const FREE_TIER_WAIT_TIME_SECONDS = 6;

export type AIUserMessageFormWrapperProps = {
  textareaRef: React.RefObject<HTMLTextAreaElement>;
  autoFocusRef?: React.RefObject<boolean>;
  initialContent?: Content;
  messageIndex?: number;
};

type Props = Omit<AIUserMessageFormWrapperProps, 'messageIndex'> & {
  abortController: AbortController | undefined;
  loading: boolean;
  setLoading: SetterOrUpdater<boolean>;
  submitPrompt: (content: Content) => void;
  formOnKeyDown?: (event: React.KeyboardEvent<HTMLTextAreaElement>) => void;
  maxHeight?: string;
  onCancel?: () => void;
  submittedMessage?: Content | null;
  isWaitingToSubmit?: boolean;
  totalDelaySeconds?: number;
  ctx?: {
    context: Context;
    setContext: React.Dispatch<React.SetStateAction<Context>>;
    initialContext?: Context;
  };
};

export const AIUserMessageForm = memo(
  forwardRef<HTMLTextAreaElement, Props>((props: Props, ref) => {
    const {
      initialContent,
      ctx,
      autoFocusRef,
      textareaRef: bottomTextareaRef,
      abortController,
      loading,
      setLoading,
      submitPrompt,
      formOnKeyDown,
      maxHeight = '120px',
      onCancel,
      submittedMessage,
      isWaitingToSubmit,
      totalDelaySeconds,
    } = props;

    const [editing, setEditing] = useState(!initialContent?.length);
    const [remainingSeconds, setRemainingSeconds] = useState(totalDelaySeconds ?? FREE_TIER_WAIT_TIME_SECONDS);

    // Handle countdown timer
    useEffect(() => {
      let timer: NodeJS.Timeout;
      if (isWaitingToSubmit && remainingSeconds > 0) {
        timer = setInterval(() => {
          setRemainingSeconds((prev) => prev - 1);
        }, 1000);
      }
      return () => {
        if (timer) {
          clearInterval(timer);
        }
      };
    }, [isWaitingToSubmit, remainingSeconds]);

    // Reset countdown when waiting state changes
    useEffect(() => {
      if (isWaitingToSubmit) {
        setRemainingSeconds(totalDelaySeconds ?? FREE_TIER_WAIT_TIME_SECONDS);
      }
    }, [isWaitingToSubmit, totalDelaySeconds]);

    const initialFiles = useMemo(() => initialContent?.filter((item) => item.type !== 'text'), [initialContent]);
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

    useEffect(() => {
      if (submittedMessage) {
        const textContent = submittedMessage.find((item) => item.type === 'text');
        if (textContent && 'text' in textContent) {
          setPrompt(textContent.text);
        }
      }
    }, [submittedMessage]);

    const submit = useCallback(() => {
      submitPrompt([...files, { type: 'text', text: prompt }]);
      // Clear input immediately after submission
      setPrompt('');
      setFiles([]);
    }, [files, prompt, submitPrompt]);

    // Clear input when waiting state changes from true to false (message was sent)
    useEffect(() => {
      if (!isWaitingToSubmit && submittedMessage) {
        setPrompt('');
        setFiles([]);
      }
    }, [isWaitingToSubmit, submittedMessage]);

    const abortPrompt = useCallback(() => {
      abortController?.abort();
      setLoading(false);
    }, [abortController, setLoading]);

    const handleFiles = useCallback((e: ClipboardEvent<HTMLFormElement> | DragEvent<HTMLFormElement>) => {
      if (!debug) return;

      const files = 'clipboardData' in e ? e.clipboardData.files : 'dataTransfer' in e ? e.dataTransfer.files : [];
      if (files && files.length > 0) {
        e.preventDefault();

        for (const file of files) {
          const mimeType = file.type;
          if (isSupportedMimeType(mimeType)) {
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
    }, []);

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
        className={cn('group relative h-min rounded-lg bg-accent', ctx && 'pt-1.5', editing ? '' : 'select-none')}
        onSubmit={(e) => e.preventDefault()}
        onClick={() => {
          if (editing) {
            textareaRef.current?.focus();
          }
        }}
        onPaste={handleFiles}
        onDrop={handleFiles}
      >
        {!editing && !loading && !isWaitingToSubmit && (
          <TooltipPopover label="Edit">
            <Button
              variant="ghost"
              className="pointer-events-auto absolute right-0.5 top-0.5 bg-accent text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100"
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

        {ctx && (
          <AIAnalystContext
            initialContext={ctx.initialContext}
            context={ctx.context}
            setContext={ctx.setContext}
            files={files}
            setFiles={setFiles}
            editing={editing}
            disabled={isWaitingToSubmit || !editing}
            textAreaRef={textareaRef}
          />
        )}
        {editing ? (
          <>
            <Textarea
              ref={textareaRef}
              value={prompt}
              className={cn(
                'rounded-none border-none p-2 pb-0 shadow-none focus-visible:ring-0',
                editing ? 'min-h-14' : 'pointer-events-none h-fit min-h-fit',
                isWaitingToSubmit && 'pointer-events-none opacity-50'
              )}
              onChange={(event) => setPrompt(event.target.value)}
              onKeyDown={(event) => {
                event.stopPropagation();

                if (event.key === 'Enter' && !(event.ctrlKey || event.shiftKey)) {
                  event.preventDefault();
                  if (loading || isWaitingToSubmit) return;

                  if (prompt.trim().length === 0) return;

                  submit();

                  if (initialPrompt === undefined) {
                    setFiles([]);
                    setPrompt('');
                    textareaRef.current?.focus();
                  } else {
                    setEditing(false);
                    bottomTextareaRef.current?.focus();
                  }
                }

                if (loading || isWaitingToSubmit) return;

                if (formOnKeyDown) {
                  formOnKeyDown(event);
                }
              }}
              autoComplete="off"
              placeholder={isWaitingToSubmit ? 'Waiting to send message...' : 'Ask a question...'}
              autoHeight={true}
              maxHeight={maxHeight}
              disabled={isWaitingToSubmit}
            />
            {isWaitingToSubmit && (
              <div className="mx-2 my-1 rounded-md border border-yellow-200 bg-yellow-50 px-2 py-1.5 text-xs font-medium dark:border-yellow-800 dark:bg-yellow-950/50">
                Exceeded free tier AI usage. Wait {remainingSeconds} seconds or{' '}
                <a
                  href="/team/settings"
                  target="_blank"
                  rel="noreferrer"
                  className="font-semibold text-primary hover:underline"
                  onClick={(e) => e.stopPropagation()}
                >
                  upgrade to Quadratic Pro
                </a>
              </div>
            )}
          </>
        ) : (
          <div className={cn('pointer-events-none whitespace-pre-wrap p-2 text-sm', isWaitingToSubmit && 'opacity-50')}>
            {prompt}
            {isWaitingToSubmit && (
              <div className="mt-2 text-xs text-muted-foreground">
                Exceeded free tier AI usage. Wait {remainingSeconds} seconds or{' '}
                <a
                  href="/pricing"
                  target="_blank"
                  rel="noreferrer"
                  className="text-primary hover:underline"
                  onClick={(e) => e.stopPropagation()}
                >
                  upgrade to Quadratic Pro
                </a>
              </div>
            )}
          </div>
        )}

        {editing && (
          <>
            <div
              className={cn(
                'flex w-full select-none items-center justify-between px-2 pb-1 @container',
                isWaitingToSubmit && 'pointer-events-none opacity-50'
              )}
            >
              <SelectAIModelMenu loading={loading} textAreaRef={textareaRef} />

              <div className="flex items-center gap-3 text-xs text-muted-foreground">
                <span className="hidden @sm:block">
                  {KeyboardSymbols.Shift}
                  {KeyboardSymbols.Enter} new line
                </span>

                <span className="hidden @sm:block">{KeyboardSymbols.Enter} submit</span>

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
                    disabled={prompt.length === 0 || loading || isWaitingToSubmit}
                  >
                    <ArrowUpwardIcon />
                  </Button>
                </ConditionalWrapper>
              </div>
            </div>

            {(loading || isWaitingToSubmit) && (
              <Button
                size="sm"
                variant="outline"
                className="absolute -top-10 right-1/2 z-10 translate-x-1/2 bg-background"
                onClick={(e) => {
                  e.stopPropagation();
                  abortPrompt();
                  onCancel?.();
                }}
              >
                <BackspaceIcon className="mr-1" /> Cancel {isWaitingToSubmit ? 'sending' : 'generating'}
              </Button>
            )}
          </>
        )}
      </form>
    );
  })
);

export const AIUserMessageFormDisclaimer = memo(() => {
  const teamUuid = useRecoilValue(editorInteractionStateTeamUuidAtom);
  const teamSettings = useRecoilValue(editorInteractionStateSettingsAtom);
  return (
    <p className="py-0.5 text-center text-xs text-muted-foreground">
      {teamSettings.analyticsAi
        ? 'Your data can be used to improve Quadratic. '
        : 'Some sheet data is sent to the AI model. '}
      <a
        href={teamSettings.analyticsAi ? ROUTES.TEAM_SETTINGS(teamUuid) : DOCUMENTATION_ANALYTICS_AI}
        target="_blank"
        rel="noreferrer"
        className="underline hover:text-foreground"
      >
        Learn more.
      </a>
    </p>
  );
});
