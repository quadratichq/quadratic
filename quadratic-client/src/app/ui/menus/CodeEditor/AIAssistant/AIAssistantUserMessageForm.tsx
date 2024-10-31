import { SelectAIModelMenu } from '@/app/ai/components/SelectAIModelMenu';
import {
  aiAssistantAbortControllerAtom,
  aiAssistantLoadingAtom,
  aiAssistantPromptAtom,
} from '@/app/atoms/codeEditorAtom';
import { KeyboardSymbols } from '@/app/helpers/keyboardSymbols';
import ConditionalWrapper from '@/app/ui/components/ConditionalWrapper';
import { useSubmitAIAssistantPrompt } from '@/app/ui/menus/CodeEditor/hooks/useSubmitAIAssistantPrompt';
import { ArrowUpwardIcon, StopIcon } from '@/shared/components/Icons';
import { Button } from '@/shared/shadcn/ui/button';
import { Textarea } from '@/shared/shadcn/ui/textarea';
import { TooltipPopover } from '@/shared/shadcn/ui/tooltip';
import { CircularProgress } from '@mui/material';
import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef } from 'react';
import { useRecoilState, useRecoilValue } from 'recoil';

type AIAssistantUserMessageFormProps = {
  autoFocus?: boolean;
};

export const AIAssistantUserMessageForm = forwardRef<HTMLTextAreaElement, AIAssistantUserMessageFormProps>(
  ({ autoFocus }: AIAssistantUserMessageFormProps, ref) => {
    const abortController = useRecoilValue(aiAssistantAbortControllerAtom);
    const [loading, setLoading] = useRecoilState(aiAssistantLoadingAtom);
    const [prompt, setPrompt] = useRecoilState(aiAssistantPromptAtom);

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

    return (
      <form
        className="m-2 mt-1 rounded-lg bg-accent"
        onSubmit={(e) => e.preventDefault()}
        onClick={() => textareaRef.current?.focus()}
      >
        <Textarea
          ref={textareaRef}
          value={prompt}
          className="min-h-14 rounded-none border-none p-2 pb-0 shadow-none focus-visible:ring-0"
          onChange={(event) => setPrompt(event.target.value)}
          onKeyDown={(event) => {
            event.stopPropagation();

            if (event.key === 'Enter' && !(event.ctrlKey || event.shiftKey)) {
              event.preventDefault();

              if (prompt.trim().length === 0) return;

              submitPrompt({
                userPrompt: prompt,
              });

              setPrompt('');
              event.currentTarget.focus();
            }
          }}
          autoComplete="off"
          placeholder="Ask a question..."
          autoHeight={true}
          maxHeight="120px"
        />

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
      </form>
    );
  }
);
