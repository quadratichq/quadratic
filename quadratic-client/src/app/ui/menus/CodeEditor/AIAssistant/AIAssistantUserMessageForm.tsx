import { aiAssistantAbortControllerAtom, aiAssistantLoadingAtom } from '@/app/atoms/codeEditorAtom';
import { AIUserMessageForm, AIUserMessageFormWrapperProps } from '@/app/ui/components/AIUserMessageForm';
import { useSubmitAIAssistantPrompt } from '@/app/ui/menus/CodeEditor/hooks/useSubmitAIAssistantPrompt';
import { forwardRef } from 'react';
import { useRecoilState, useRecoilValue } from 'recoil';

export const AIAssistantUserMessageForm = forwardRef<HTMLTextAreaElement, AIUserMessageFormWrapperProps>(
  (props: AIUserMessageFormWrapperProps, ref) => {
    const abortController = useRecoilValue(aiAssistantAbortControllerAtom);
    const [loading, setLoading] = useRecoilState(aiAssistantLoadingAtom);
    const { submitPrompt } = useSubmitAIAssistantPrompt();

    return (
      <AIUserMessageForm
        {...props}
        abortController={abortController}
        loading={loading}
        setLoading={setLoading}
        submitPrompt={(prompt) => submitPrompt({ userPrompt: prompt, messageIndex: props.messageIndex })}
      />
    );
  }
);
