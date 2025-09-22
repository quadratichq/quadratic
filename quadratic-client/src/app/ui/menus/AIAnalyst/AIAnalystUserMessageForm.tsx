import { Action } from '@/app/actions/actions';
import {
  aiAnalystAbortControllerAtom,
  aiAnalystCurrentChatUserMessagesCountAtom,
  aiAnalystLoadingAtom,
  aiAnalystWaitingOnMessageIndexAtom,
  showAIAnalystAtom,
} from '@/app/atoms/aiAnalystAtom';
import { matchShortcut } from '@/app/helpers/keyboardShortcuts';
import type { AIUserMessageFormWrapperProps, SubmitPromptArgs } from '@/app/ui/components/AIUserMessageForm';
import { AIUserMessageForm } from '@/app/ui/components/AIUserMessageForm';
import { AIAnalystEmptyStateWaypoint } from '@/app/ui/menus/AIAnalyst/AIAnalystEmptyStateWaypoint';
import { defaultAIAnalystContext } from '@/app/ui/menus/AIAnalyst/const/defaultAIAnalystContext';
import { useSubmitAIAnalystPrompt } from '@/app/ui/menus/AIAnalyst/hooks/useSubmitAIAnalystPrompt';
import { trackEvent } from '@/shared/utils/analyticsEvents';
import { isSupportedImageMimeType, isSupportedPdfMimeType } from 'quadratic-shared/ai/helpers/files.helper';
import type { Context } from 'quadratic-shared/typesAndSchemasAI';
import { forwardRef, memo, useState } from 'react';
import { useRecoilCallback, useRecoilState, useRecoilValue } from 'recoil';

const ANALYST_FILE_TYPES = ['image/*', '.pdf'];

export const AIAnalystUserMessageForm = memo(
  forwardRef<HTMLTextAreaElement, AIUserMessageFormWrapperProps>((props: AIUserMessageFormWrapperProps, ref) => {
    const abortController = useRecoilValue(aiAnalystAbortControllerAtom);
    const [loading, setLoading] = useRecoilState(aiAnalystLoadingAtom);
    const [context, setContext] = useState<Context>(props.initialContext ?? defaultAIAnalystContext);
    const waitingOnMessageIndex = useRecoilValue(aiAnalystWaitingOnMessageIndexAtom);
    const { submitPrompt } = useSubmitAIAnalystPrompt();

    const handleSubmit = useRecoilCallback(
      ({ snapshot }) =>
        async ({ content }: SubmitPromptArgs) => {
          const userMessagesCount = await snapshot.getPromise(aiAnalystCurrentChatUserMessagesCountAtom);
          trackEvent('[AIAnalyst].submitPrompt', { userMessageCountUponSubmit: userMessagesCount });

          submitPrompt({
            messageSource: 'User',
            content,
            context,
            messageIndex: props.messageIndex,
          });
        },
      [context, props.messageIndex, submitPrompt]
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
      <div className="flex h-full flex-col justify-center gap-2">
        <AIUserMessageForm
          {...props}
          ref={ref}
          abortController={abortController}
          loading={loading}
          setLoading={setLoading}
          context={context}
          setContext={setContext}
          isFileSupported={(mimeType) => isSupportedImageMimeType(mimeType) || isSupportedPdfMimeType(mimeType)}
          fileTypes={ANALYST_FILE_TYPES}
          submitPrompt={handleSubmit}
          formOnKeyDown={formOnKeyDown}
          waitingOnMessageIndex={waitingOnMessageIndex}
          maxHeight="275px"
        />

        <AIAnalystEmptyStateWaypoint />
      </div>
    );
  })
);
