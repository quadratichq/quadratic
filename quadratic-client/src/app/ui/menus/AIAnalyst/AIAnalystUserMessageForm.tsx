import { SelectAIModelMenu } from '@/app/ai/components/SelectAIModelMenu';
import {
  aiAnalystAbortControllerAtom,
  aiAnalystCurrentChatMessagesAtom,
  aiAnalystCurrentChatMessagesCountAtom,
  aiAnalystLoadingAtom,
} from '@/app/atoms/aiAnalystAtom';
import { KeyboardSymbols } from '@/app/helpers/keyboardSymbols';
import ConditionalWrapper from '@/app/ui/components/ConditionalWrapper';
import { AIAnalystContext } from '@/app/ui/menus/AIAnalyst/AIAnalystContext';
import {
  defaultAIAnalystContext,
  useSubmitAIAnalystPrompt,
} from '@/app/ui/menus/AIAnalyst/hooks/useSubmitAIAnalystPrompt';
import { ArrowUpwardIcon, EditIcon, StopIcon } from '@/shared/components/Icons';
import { Button } from '@/shared/shadcn/ui/button';
import { Textarea } from '@/shared/shadcn/ui/textarea';
import { TooltipPopover } from '@/shared/shadcn/ui/tooltip';
import { cn } from '@/shared/shadcn/utils';
import { CircularProgress } from '@mui/material';
import { Context, UserMessagePrompt } from 'quadratic-shared/typesAndSchemasAI';
import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState } from 'react';
import { useRecoilState, useRecoilValue } from 'recoil';

type AIAnalystUserMessageFormProps = {
  initialPrompt?: string;
  initialContext?: Context;
  messageIndex?: number;
  autoFocus?: boolean;
  textareaRef: React.RefObject<HTMLTextAreaElement>;
};

export const AIAnalystUserMessageForm = forwardRef<HTMLTextAreaElement, AIAnalystUserMessageFormProps>(
  (props: AIAnalystUserMessageFormProps, ref) => {
    const { initialPrompt, initialContext, messageIndex, autoFocus, textareaRef: bottomTextareaRef } = props;
    const abortController = useRecoilValue(aiAnalystAbortControllerAtom);
    const [loading, setLoading] = useRecoilState(aiAnalystLoadingAtom);
    const messages = useRecoilValue(aiAnalystCurrentChatMessagesAtom);
    const messagesCount = useRecoilValue(aiAnalystCurrentChatMessagesCountAtom);

    const [edit, setEdit] = useState(!initialPrompt);
    const [context, setContext] = useState<Context>(initialContext ?? defaultAIAnalystContext);
    const [prompt, setPrompt] = useState(initialPrompt ?? '');
    const { submitPrompt } = useSubmitAIAnalystPrompt();

    const abortPrompt = useCallback(() => {
      abortController?.abort();
      setLoading(false);
    }, [abortController, setLoading]);

    const textareaRef = useRef<HTMLTextAreaElement>(null);
    useImperativeHandle(ref, () => textareaRef.current!);

    // Focus the input when relevant & the tab comes into focus
    useEffect(() => {
      if (autoFocus) {
        window.requestAnimationFrame(() => {
          textareaRef.current?.focus();
        });
      }
    }, [autoFocus, textareaRef]);

    useEffect(() => {
      if (initialPrompt === undefined && messagesCount > 0) {
        const lastUserMessage = messages
          .filter(
            (message): message is UserMessagePrompt => message.role === 'user' && message.contextType === 'userPrompt'
          )
          .at(-1);
        if (lastUserMessage) {
          setContext(lastUserMessage.context);
        }
      }
    }, [initialPrompt, messages, messagesCount]);

    return (
      <form
        className={cn('group z-10 m-2 h-min rounded-lg bg-slate-100 pt-1', edit ? '' : 'select-none')}
        onSubmit={(e) => e.preventDefault()}
        onClick={() => {
          if (edit) {
            textareaRef.current?.focus();
          }
        }}
      >
        <div className="flex flex-row items-start justify-between">
          <AIAnalystContext context={context} setContext={setContext} textAreaRef={textareaRef} disabled={!edit} />

          {!edit && (
            <TooltipPopover label="Edit">
              <Button
                className="pointer-events-auto h-4 pr-2 opacity-0 transition-opacity group-hover:opacity-100"
                variant="ghost"
                onClick={(e) => {
                  e.stopPropagation();
                  setEdit(true);
                  textareaRef.current?.focus();
                }}
              >
                <EditIcon />
              </Button>
            </TooltipPopover>
          )}
        </div>

        <Textarea
          ref={textareaRef}
          value={prompt}
          className={cn(
            'rounded-none border-none p-2 pb-0 shadow-none focus-visible:ring-0',
            edit ? 'min-h-14' : 'pointer-events-none h-fit min-h-fit'
          )}
          onChange={(event) => setPrompt(event.target.value)}
          onKeyDown={(event) => {
            event.stopPropagation();

            if (event.key === 'Enter' && !(event.ctrlKey || event.shiftKey)) {
              event.preventDefault();

              if (prompt.trim().length === 0) return;

              submitPrompt({ userPrompt: prompt, context, messageIndex });

              if (initialPrompt === undefined) {
                setPrompt('');
                textareaRef.current?.focus();
              } else {
                setEdit(false);
                bottomTextareaRef.current?.focus();
              }
            }
          }}
          autoComplete="off"
          placeholder="Ask a question..."
          autoHeight={edit}
          maxHeight={edit ? '120px' : 'unset'}
        />

        {edit && (
          <div className="flex w-full select-none items-center justify-between px-2 pb-1 @container">
            <SelectAIModelMenu loading={loading} textAreaRef={textareaRef} />

            {loading ? (
              <div className="flex items-center gap-2">
                <CircularProgress size="0.8125rem" />

                <TooltipPopover label="Stop generating">
                  <Button
                    size="icon-sm"
                    onClick={(e) => {
                      e.stopPropagation();
                      abortPrompt();
                    }}
                  >
                    <StopIcon />
                  </Button>
                </TooltipPopover>
              </div>
            ) : (
              <div className="flex items-center gap-3 text-xs text-slate-500">
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
                      submitPrompt({ userPrompt: prompt, context, messageIndex });
                    }}
                    disabled={prompt.length === 0}
                  >
                    <ArrowUpwardIcon />
                  </Button>
                </ConditionalWrapper>
              </div>
            )}
          </div>
        )}
      </form>
    );
  }
);
