import { Action } from '@/app/actions/actions';
import {
  aiAnalystAbortControllerAtom,
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
import type { Context } from 'quadratic-shared/typesAndSchemasAI';
import { forwardRef, memo, useCallback, useState } from 'react';
import { useRecoilCallback, useRecoilState, useRecoilValue } from 'recoil';

type Props = AIUserMessageFormWrapperProps & {
  initialContext?: Context;
};

export const AIAnalystUserMessageForm = memo(
  forwardRef<HTMLTextAreaElement, Props>((props: Props, ref) => {
    const { initialContext, ...rest } = props;
    const abortController = useRecoilValue(aiAnalystAbortControllerAtom);
    const [loading, setLoading] = useRecoilState(aiAnalystLoadingAtom);
    const [context, setContext] = useState<Context>(initialContext ?? defaultAIAnalystContext);
    const waitingOnMessageIndex = useRecoilValue(aiAnalystWaitingOnMessageIndexAtom);
    const delaySeconds = useRecoilValue(aiAnalystDelaySecondsAtom);
    const { submitPrompt } = useSubmitAIAnalystPrompt();

    const handleSubmit = useCallback(
      ({ content, onSubmit }: SubmitPromptArgs) => {
        mixpanel.track('[AIAnalyst].submitPrompt', {
          freeTierExceeded: delaySeconds > 0,
          delaySeconds,
        });
        submitPrompt({
          content,
          context,
          messageIndex: props.messageIndex,
          onSubmit,
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
      <AIUserMessageForm
        {...rest}
        ref={ref}
        abortController={abortController}
        loading={loading}
        setLoading={setLoading}
        submitPrompt={handleSubmit}
        formOnKeyDown={formOnKeyDown}
        ctx={{
          context,
          setContext,
          initialContext,
        }}
        waitingOnMessageIndex={waitingOnMessageIndex}
        delaySeconds={delaySeconds}
        maxHeight="275px"
      />
    );
  })
);
