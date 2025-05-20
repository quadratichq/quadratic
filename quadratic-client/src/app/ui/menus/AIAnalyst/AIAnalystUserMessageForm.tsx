import { Action } from '@/app/actions/actions';
import {
  aiAnalystAbortControllerAtom,
  aiAnalystCurrentChatUserMessagesCountAtom,
  aiAnalystDelaySecondsAtom,
  aiAnalystLoadingAtom,
  aiAnalystWaitingOnMessageIndexAtom,
  showAIAnalystAtom,
} from '@/app/atoms/aiAnalystAtom';
import { matchShortcut } from '@/app/helpers/keyboardShortcuts';
import type { AIUserMessageFormWrapperProps, SubmitPromptArgs } from '@/app/ui/components/AIUserMessageForm';
import { AIUserMessageForm } from '@/app/ui/components/AIUserMessageForm';
import { defaultAIAnalystContext } from '@/app/ui/menus/AIAnalyst/const/defaultAIAnalystContext';
import { useSubmitAIAnalystPrompt } from '@/app/ui/menus/AIAnalyst/hooks/useSubmitAIAnalystPrompt';
import mixpanel from 'mixpanel-browser';
import { isSupportedImageMimeType, isSupportedPdfMimeType } from 'quadratic-shared/ai/helpers/files.helper';
import type { Context } from 'quadratic-shared/typesAndSchemasAI';
import { forwardRef, memo, useCallback, useState } from 'react';
import { useRecoilCallback, useRecoilState, useRecoilValue } from 'recoil';

const ANALYST_FILE_TYPES = ['image/*', '.pdf'];

type AIAnalystUserMessageFormProps = AIUserMessageFormWrapperProps & {
  initialContext?: Context;
};

export const AIAnalystUserMessageForm = memo(
  forwardRef<HTMLTextAreaElement, AIAnalystUserMessageFormProps>((props: AIAnalystUserMessageFormProps, ref) => {
    const { initialContext, ...rest } = props;
    const abortController = useRecoilValue(aiAnalystAbortControllerAtom);
    const [loading, setLoading] = useRecoilState(aiAnalystLoadingAtom);
    const [context, setContext] = useState<Context>(initialContext ?? defaultAIAnalystContext);
    const userMessagesCount = useRecoilValue(aiAnalystCurrentChatUserMessagesCountAtom);
    const waitingOnMessageIndex = useRecoilValue(aiAnalystWaitingOnMessageIndexAtom);
    const delaySeconds = useRecoilValue(aiAnalystDelaySecondsAtom);
    const { submitPrompt } = useSubmitAIAnalystPrompt();

    const handleSubmit = useCallback(
      ({ content, onSubmit }: SubmitPromptArgs) => {
        mixpanel.track('[AIAnalyst].submitPrompt', { userMessageCountUponSubmit: userMessagesCount });
        submitPrompt({
          content,
          context,
          messageIndex: props.messageIndex,
          onSubmit,
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
        delaySeconds={delaySeconds}
        maxHeight="275px"
      />
    );
  })
);
