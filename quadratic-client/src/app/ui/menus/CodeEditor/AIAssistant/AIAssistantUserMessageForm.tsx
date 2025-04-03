import { aiAssistantAbortControllerAtom, aiAssistantLoadingAtom } from '@/app/atoms/codeEditorAtom';
import type { AIUserMessageFormWrapperProps, SubmitPromptArgs } from '@/app/ui/components/AIUserMessageForm';
import { AIUserMessageForm } from '@/app/ui/components/AIUserMessageForm';
import { useSubmitAIAssistantPrompt } from '@/app/ui/menus/CodeEditor/hooks/useSubmitAIAssistantPrompt';
import mixpanel from 'mixpanel-browser';
import { isSupportedImageMimeType } from 'quadratic-shared/ai/helpers/files.helper';
import { forwardRef, memo, useCallback } from 'react';
import { useRecoilState, useRecoilValue } from 'recoil';

export const AIAssistantUserMessageForm = memo(
  forwardRef<HTMLTextAreaElement, AIUserMessageFormWrapperProps>((props: AIUserMessageFormWrapperProps, ref) => {
    const abortController = useRecoilValue(aiAssistantAbortControllerAtom);
    const [loading, setLoading] = useRecoilState(aiAssistantLoadingAtom);
    const { submitPrompt } = useSubmitAIAssistantPrompt();

    const handleSubmit = useCallback(
      ({ content, onSubmit }: SubmitPromptArgs) => {
        mixpanel.track('[AIAssistant].submitPrompt');
        submitPrompt({ content, messageIndex: props.messageIndex });
        onSubmit?.();
      },
      [props.messageIndex, submitPrompt]
    );

    return (
      <AIUserMessageForm
        {...props}
        abortController={abortController}
        loading={loading}
        setLoading={setLoading}
        isFileSupported={isSupportedImageMimeType}
        submitPrompt={handleSubmit}
      />
    );
  })
);
