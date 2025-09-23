import { Action } from '@/app/actions/actions';
import {
  aiAnalystAbortControllerAtom,
  aiAnalystClarifyingQuestionsModeAtom,
  aiAnalystCurrentChatUserMessagesCountAtom,
  aiAnalystLoadingAtom,
  aiAnalystWaitingOnMessageIndexAtom,
  showAIAnalystAtom,
} from '@/app/atoms/aiAnalystAtom';
import { matchShortcut } from '@/app/helpers/keyboardShortcuts';
import type { AIUserMessageFormWrapperProps, SubmitPromptArgs } from '@/app/ui/components/AIUserMessageForm';
import { AIUserMessageForm } from '@/app/ui/components/AIUserMessageForm';
import { defaultAIAnalystContext } from '@/app/ui/menus/AIAnalyst/const/defaultAIAnalystContext';
import { useSubmitAIAnalystPrompt } from '@/app/ui/menus/AIAnalyst/hooks/useSubmitAIAnalystPrompt';
import { HelpIcon } from '@/shared/components/Icons';
import { Button } from '@/shared/shadcn/ui/button';
import { TooltipPopover } from '@/shared/shadcn/ui/tooltip';
import { cn } from '@/shared/shadcn/utils';
import { trackEvent } from '@/shared/utils/analyticsEvents';
import { isSupportedImageMimeType, isSupportedPdfMimeType } from 'quadratic-shared/ai/helpers/files.helper';
import type { Context } from 'quadratic-shared/typesAndSchemasAI';
import { forwardRef, memo, useCallback, useState } from 'react';
import { useRecoilCallback, useRecoilState, useRecoilValue } from 'recoil';

const ANALYST_FILE_TYPES = ['image/*', '.pdf'];

export const AIAnalystUserMessageForm = memo(
  forwardRef<HTMLTextAreaElement, AIUserMessageFormWrapperProps>((props: AIUserMessageFormWrapperProps, ref) => {
    const { initialContext, ...rest } = props;
    const abortController = useRecoilValue(aiAnalystAbortControllerAtom);
    const [loading, setLoading] = useRecoilState(aiAnalystLoadingAtom);
    const [clarifyingQuestionsMode, setClarifyingQuestionsMode] = useRecoilState(aiAnalystClarifyingQuestionsModeAtom);
    const [context, setContext] = useState<Context>(initialContext ?? defaultAIAnalystContext);
    const userMessagesCount = useRecoilValue(aiAnalystCurrentChatUserMessagesCountAtom);
    const waitingOnMessageIndex = useRecoilValue(aiAnalystWaitingOnMessageIndexAtom);
    const { submitPrompt } = useSubmitAIAnalystPrompt();

    const handleSubmit = useCallback(
      ({ content }: SubmitPromptArgs) => {
        trackEvent('[AIAnalyst].submitPrompt', { userMessageCountUponSubmit: userMessagesCount });
        submitPrompt({
          messageSource: 'User',
          content,
          context,
          messageIndex: props.messageIndex,
        });
      },
      [context, props.messageIndex, submitPrompt, userMessagesCount]
    );

    const formOnKeyDown = useRecoilCallback(
      ({ set }) =>
        (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
          if (matchShortcut(Action.ToggleAIAnalyst, event)) {
            event.preventDefault();
            set(showAIAnalystAtom, (prev) => !prev);
          }
        },
      []
    );

    const clarifyingQuestionsToggle = (
      <TooltipPopover label="Clarifying questions mode">
        <Button
          variant={clarifyingQuestionsMode ? 'default' : 'ghost'}
          size="icon-sm"
          className={cn(!clarifyingQuestionsMode && 'text-muted-foreground hover:text-foreground', 'h-6 w-6')}
          disabled={loading || waitingOnMessageIndex !== undefined}
          onClick={() => {
            setClarifyingQuestionsMode((prev) => !prev);
          }}
        >
          <HelpIcon className="h-3.5 w-3.5" />
        </Button>
      </TooltipPopover>
    );

    return (
      <AIUserMessageForm
        {...rest}
        ref={ref}
        abortController={abortController}
        loading={loading}
        setLoading={setLoading}
        isFileSupported={(mimeType) => isSupportedImageMimeType(mimeType) || isSupportedPdfMimeType(mimeType)}
        fileTypes={ANALYST_FILE_TYPES}
        submitPrompt={handleSubmit}
        formOnKeyDown={formOnKeyDown}
        ctx={{
          initialContext,
          context,
          setContext,
        }}
        waitingOnMessageIndex={waitingOnMessageIndex}
        maxHeight="275px"
        extraLeftButtons={clarifyingQuestionsToggle}
      />
    );
  })
);
