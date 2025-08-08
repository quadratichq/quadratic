import {
  aiAssistantAbortControllerAtom,
  aiAssistantLoadingAtom,
  aiAssistantWaitingOnMessageIndexAtom,
  codeEditorCodeCellAtom,
} from '@/app/atoms/codeEditorAtom';
import type { AIUserMessageFormWrapperProps, SubmitPromptArgs } from '@/app/ui/components/AIUserMessageForm';
import { AIUserMessageForm } from '@/app/ui/components/AIUserMessageForm';
import { useSubmitAIAssistantPrompt } from '@/app/ui/menus/CodeEditor/hooks/useSubmitAIAssistantPrompt';
import { trackEvent } from '@/shared/utils/analyticsEvents';
import { isSupportedImageMimeType } from 'quadratic-shared/ai/helpers/files.helper';
import { forwardRef, memo, useCallback } from 'react';
import { useRecoilState, useRecoilValue } from 'recoil';

const ASSISTANT_FILE_TYPES = ['image/*'];

export const AIAssistantUserMessageForm = memo(
  forwardRef<HTMLTextAreaElement, AIUserMessageFormWrapperProps>((props: AIUserMessageFormWrapperProps, ref) => {
    const codeCell = useRecoilValue(codeEditorCodeCellAtom);
    const abortController = useRecoilValue(aiAssistantAbortControllerAtom);
    const [loading, setLoading] = useRecoilState(aiAssistantLoadingAtom);
    const waitingOnMessageIndex = useRecoilValue(aiAssistantWaitingOnMessageIndexAtom);
    const { submitPrompt } = useSubmitAIAssistantPrompt();

    const handleSubmit = useCallback(
      ({ content }: SubmitPromptArgs) => {
        trackEvent('[AIAssistant].submitPrompt');
        submitPrompt({
          messageSource: 'User',
          content,
          messageIndex: props.messageIndex,
        });
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
        fileTypes={ASSISTANT_FILE_TYPES}
        submitPrompt={handleSubmit}
        ctx={{ context: { sheets: [], currentSheet: '', codeCell } }}
        waitingOnMessageIndex={waitingOnMessageIndex}
      />
    );
  })
);
