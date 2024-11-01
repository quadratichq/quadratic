import { SelectAIModelMenu } from '@/app/ai/components/SelectAIModelMenu';
import { aiAssistantAbortControllerAtom, aiAssistantLoadingAtom } from '@/app/atoms/codeEditorAtom';
import { KeyboardSymbols } from '@/app/helpers/keyboardSymbols';
import ConditionalWrapper from '@/app/ui/components/ConditionalWrapper';
import { useSubmitAIAssistantPrompt } from '@/app/ui/menus/CodeEditor/hooks/useSubmitAIAssistantPrompt';
import { ArrowUpwardIcon, EditIcon, StopIcon } from '@/shared/components/Icons';
import { Button } from '@/shared/shadcn/ui/button';
import { Textarea } from '@/shared/shadcn/ui/textarea';
import { TooltipPopover } from '@/shared/shadcn/ui/tooltip';
import { cn } from '@/shared/shadcn/utils';
import { CircularProgress } from '@mui/material';
import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState } from 'react';
import { useRecoilState, useRecoilValue } from 'recoil';

type AIAssistantUserMessageFormProps = {
  initialPrompt?: string;
  messageIndex?: number;
  autoFocus?: boolean;
  textareaRef: React.RefObject<HTMLTextAreaElement>;
};

export const AIAssistantUserMessageForm = forwardRef<HTMLTextAreaElement, AIAssistantUserMessageFormProps>(
  (
    { initialPrompt, messageIndex, autoFocus, textareaRef: bottomTextareaRef }: AIAssistantUserMessageFormProps,
    ref
  ) => {
    const abortController = useRecoilValue(aiAssistantAbortControllerAtom);
    const [loading, setLoading] = useRecoilState(aiAssistantLoadingAtom);

    const [edit, setEdit] = useState(!initialPrompt);
    const [prompt, setPrompt] = useState(initialPrompt ?? '');
    const { submitPrompt } = useSubmitAIAssistantPrompt();

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
    }, [autoFocus]);

    useEffect(() => {
      if (loading && initialPrompt !== undefined) {
        setEdit(false);
      }
    }, [loading, initialPrompt]);

    return (
      <form
        className={cn('group relative m-2 h-min rounded-lg bg-accent', edit ? '' : 'select-none')}
        onSubmit={(e) => e.preventDefault()}
        onClick={() => {
          if (edit) {
            textareaRef.current?.focus();
          }
        }}
      >
        {!edit && !loading && (
          <TooltipPopover label="Edit">
            <Button
              className="pointer-events-auto absolute right-2 top-2 h-4 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100"
              variant="ghost"
              size="icon-sm"
              onClick={(e) => {
                if (loading) return;
                e.stopPropagation();
                setEdit(true);
                textareaRef.current?.focus();
              }}
            >
              <EditIcon />
            </Button>
          </TooltipPopover>
        )}

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

              submitPrompt({ userPrompt: prompt, messageIndex });

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
                      submitPrompt({ userPrompt: prompt });
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
