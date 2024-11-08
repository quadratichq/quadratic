import { Action } from '@/app/actions/actions';
import {
  aiAnalystAbortControllerAtom,
  aiAnalystLoadingAtom,
  defaultAIAnalystContext,
  showAIAnalystAtom,
} from '@/app/atoms/aiAnalystAtom';
import { matchShortcut } from '@/app/helpers/keyboardShortcuts';
import { AIUserMessageForm, AIUserMessageFormWrapperProps } from '@/app/ui/components/AIUserMessageForm';
import { useSubmitAIAnalystPrompt } from '@/app/ui/menus/AIAnalyst/hooks/useSubmitAIAnalystPrompt';
import { Context } from 'quadratic-shared/typesAndSchemasAI';
import { forwardRef, useState } from 'react';
import { useRecoilState, useRecoilValue, useSetRecoilState } from 'recoil';

type Props = AIUserMessageFormWrapperProps & {
  initialContext?: Context;
};

export const AIAnalystUserMessageForm = forwardRef<HTMLTextAreaElement, Props>((props: Props, ref) => {
  const { initialContext, ...rest } = props;
  const abortController = useRecoilValue(aiAnalystAbortControllerAtom);
  const [loading, setLoading] = useRecoilState(aiAnalystLoadingAtom);
  const setShowAIAnalyst = useSetRecoilState(showAIAnalystAtom);
  const _initialContext = initialContext ?? defaultAIAnalystContext;
  const [context, setContext] = useState<Context>(_initialContext);
  const { submitPrompt } = useSubmitAIAnalystPrompt();

  const formOnKeyDown = (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (matchShortcut(Action.ToggleAIAnalyst, event)) {
      event.preventDefault();
      setShowAIAnalyst((prev) => !prev);
    }
  };

  return (
    <AIUserMessageForm
      {...rest}
      abortController={abortController}
      loading={loading}
      setLoading={setLoading}
      submitPrompt={(prompt) => submitPrompt({ userPrompt: prompt, context, messageIndex: props.messageIndex })}
      formOnKeyDown={formOnKeyDown}
      ctx={{
        context,
        setContext,
        initialContext: _initialContext,
      }}
    />
  );
});
