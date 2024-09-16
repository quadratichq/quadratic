import {
  aiAssistantAbortControllerAtom,
  aiAssistantLoadingAtom,
  aiAssistantPromptAtom,
} from '@/app/atoms/aiAssistantAtom';
import {
  editorInteractionStateModeAtom,
  editorInteractionStateSelectedCellAtom,
  editorInteractionStateSelectedCellSheetAtom,
} from '@/app/atoms/editorInteractionStateAtom';
import { getConnectionKind } from '@/app/helpers/codeCellLanguage';
import { KeyboardSymbols } from '@/app/helpers/keyboardSymbols';
import ConditionalWrapper from '@/app/ui/components/ConditionalWrapper';
import { AIAssistantSelectAIModelMenu } from '@/app/ui/menus/AIAssistant/AIAssistantSelectAIModelMenu';
import { useSubmitAIAssistantPrompt } from '@/app/ui/menus/AIAssistant/useSubmitAIAssistantPrompt';
import { Button } from '@/shared/shadcn/ui/button';
import { Textarea } from '@/shared/shadcn/ui/textarea';
import { TooltipPopover } from '@/shared/shadcn/ui/tooltip';
import { ArrowUpward, Stop } from '@mui/icons-material';
import { CircularProgress } from '@mui/material';
import mixpanel from 'mixpanel-browser';
import { useCallback, useEffect, useRef } from 'react';
import { useRecoilState, useRecoilValue } from 'recoil';

type AIAssistantUserMessageFormProps = {
  autoFocus?: boolean;
};

export function AIAssistantUserMessageForm({ autoFocus }: AIAssistantUserMessageFormProps) {
  const selectedCellSheet = useRecoilValue(editorInteractionStateSelectedCellSheetAtom);
  const selectedCell = useRecoilValue(editorInteractionStateSelectedCellAtom);
  const submitPrompt = useSubmitAIAssistantPrompt();

  const abortController = useRecoilValue(aiAssistantAbortControllerAtom);
  const [prompt, setPrompt] = useRecoilState(aiAssistantPromptAtom);
  const [loading, setLoading] = useRecoilState(aiAssistantLoadingAtom);

  const mode = useRecoilValue(editorInteractionStateModeAtom);
  const abortPrompt = useCallback(() => {
    mixpanel.track('[AI].prompt.cancel', { language: getConnectionKind(mode) });
    abortController?.abort();
    setLoading(false);
  }, [abortController, mode, setLoading]);

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  // Focus the input when relevant & the tab comes into focus
  useEffect(() => {
    if (autoFocus) {
      window.requestAnimationFrame(() => {
        textareaRef.current?.focus();
      });
    }
  }, [autoFocus]);

  return (
    <form className="z-10 m-3 rounded-lg bg-slate-100" onSubmit={(e) => e.preventDefault()}>
      <Textarea
        ref={textareaRef}
        id="prompt-input"
        value={prompt}
        className="min-h-14 rounded-none border-none p-2 pb-0 shadow-none focus-visible:ring-0"
        onChange={(event) => setPrompt(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === 'Enter') {
            if (event.ctrlKey || event.shiftKey) return;
            event.preventDefault();
            if (prompt.trim().length === 0) return;

            mixpanel.track('[AI].prompt.send', { language: getConnectionKind(mode) });
            submitPrompt({ sheetId: selectedCellSheet, pos: selectedCell, userPrompt: prompt });
            event.currentTarget.focus();
          }
        }}
        autoComplete="off"
        placeholder="Ask a question..."
        autoHeight={true}
        maxHeight="120px"
      />

      <div
        className="flex w-full select-none items-center justify-between px-2 pb-1 @container"
        onClick={() => {
          textareaRef.current?.focus();
        }}
      >
        <AIAssistantSelectAIModelMenu />

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
                <Stop fontSize="small" />
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
                onClick={(e) => {
                  e.stopPropagation();
                  submitPrompt({ sheetId: selectedCellSheet, pos: selectedCell, userPrompt: prompt });
                }}
                disabled={prompt.length === 0}
              >
                <ArrowUpward fontSize="small" />
              </Button>
            </ConditionalWrapper>
          </div>
        )}
      </div>
    </form>
  );
}
