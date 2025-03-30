import { Action } from '@/app/actions/actions';
import { aiAnalystAbortControllerAtom, aiAnalystLoadingAtom, showAIAnalystAtom } from '@/app/atoms/aiAnalystAtom';
import { matchShortcut } from '@/app/helpers/keyboardShortcuts';
import type { AIUserMessageFormWrapperProps } from '@/app/ui/components/AIUserMessageForm';
import { AIUserMessageForm, FREE_TIER_WAIT_TIME_SECONDS } from '@/app/ui/components/AIUserMessageForm';
import { defaultAIAnalystContext } from '@/app/ui/menus/AIAnalyst/const/defaultAIAnalystContext';
import { useSubmitAIAnalystPrompt } from '@/app/ui/menus/AIAnalyst/hooks/useSubmitAIAnalystPrompt';
import mixpanel from 'mixpanel-browser';
import type { Content, Context } from 'quadratic-shared/typesAndSchemasAI';
import { forwardRef, memo, useCallback, useEffect, useState } from 'react';
import { useRecoilCallback, useRecoilState, useRecoilValue } from 'recoil';

// Simulate API check - will be replaced with actual API call later
const hasHitBillableLimit = () => true;

type Props = AIUserMessageFormWrapperProps & {
  initialContext?: Context;
};

export const AIAnalystUserMessageForm = memo(
  forwardRef<HTMLTextAreaElement, Props>((props: Props, ref) => {
    const { initialContext, ...rest } = props;
    const abortController = useRecoilValue(aiAnalystAbortControllerAtom);
    const [loading, setLoading] = useRecoilState(aiAnalystLoadingAtom);
    const [context, setContext] = useState<Context>(initialContext ?? defaultAIAnalystContext);
    const [delayTimer, setDelayTimer] = useState<NodeJS.Timeout | null>(null);
    const [isWaitingToSubmit, setIsWaitingToSubmit] = useState(false);
    const [submittedMessage, setSubmittedMessage] = useState<Content | null>(null);
    const { submitPrompt } = useSubmitAIAnalystPrompt();

    // Cancel the delay timer if component unmounts or user cancels
    useEffect(() => {
      return () => {
        if (delayTimer) {
          clearTimeout(delayTimer);
        }
      };
    }, [delayTimer]);

    const handleSubmitWithDelay = useCallback(
      (content: Content) => {
        const isOverLimit = hasHitBillableLimit();

        if (isOverLimit) {
          setIsWaitingToSubmit(true);
          setSubmittedMessage(content);
          const timer = setTimeout(() => {
            mixpanel.track('[AIAnalyst].submitPrompt');
            const textContent = content[0];
            if (textContent.type === 'text') {
              submitPrompt({
                content: [{ type: 'text', text: textContent.text }],
                context,
                messageIndex: props.messageIndex,
              });
            }
            setIsWaitingToSubmit(false);
            setDelayTimer(null);
            setSubmittedMessage(null);
          }, FREE_TIER_WAIT_TIME_SECONDS * 1000);
          setDelayTimer(timer);
        } else {
          mixpanel.track('[AIAnalyst].submitPrompt');
          const textContent = content[0];
          if (textContent.type === 'text') {
            submitPrompt({
              content: [{ type: 'text', text: textContent.text }],
              context,
              messageIndex: props.messageIndex,
            });
          }
        }
      },
      [context, props.messageIndex, submitPrompt]
    );

    const cancelDelayedSubmit = useCallback(() => {
      if (delayTimer) {
        clearTimeout(delayTimer);
        setDelayTimer(null);
        setIsWaitingToSubmit(false);
        setSubmittedMessage(null);
      }
    }, [delayTimer]);

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
        loading={loading || isWaitingToSubmit}
        setLoading={setLoading}
        submitPrompt={handleSubmitWithDelay}
        formOnKeyDown={formOnKeyDown}
        ctx={{
          context,
          setContext,
          initialContext,
        }}
        maxHeight="275px"
        onCancel={cancelDelayedSubmit}
        submittedMessage={submittedMessage}
        isWaitingToSubmit={isWaitingToSubmit}
      />
    );
  })
);
