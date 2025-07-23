import { useAIModel } from '@/app/ai/hooks/useAIModel';
import {
  aiAssistantAbortControllerAtom,
  aiAssistantLoadingAtom,
  aiAssistantWaitingOnMessageIndexAtom,
  codeEditorCodeCellAtom,
} from '@/app/atoms/codeEditorAtom';
import type { AIUserMessageFormWrapperProps, SubmitPromptArgs } from '@/app/ui/components/AIUserMessageForm';
import { AIUserMessageForm } from '@/app/ui/components/AIUserMessageForm';
import { useSubmitAIAssistantPrompt } from '@/app/ui/menus/CodeEditor/hooks/useSubmitAIAssistantPrompt';
import mixpanel from 'mixpanel-browser';
import { isSupportedImageMimeType } from 'quadratic-shared/ai/helpers/files.helper';
import { forwardRef, memo, useCallback, useMemo } from 'react';
import { useRecoilState, useRecoilValue } from 'recoil';

export const AIAssistantUserMessageForm = memo(
  forwardRef<HTMLTextAreaElement, AIUserMessageFormWrapperProps>((props: AIUserMessageFormWrapperProps, ref) => {
    const codeCell = useRecoilValue(codeEditorCodeCellAtom);
    const abortController = useRecoilValue(aiAssistantAbortControllerAtom);
    const [loading, setLoading] = useRecoilState(aiAssistantLoadingAtom);
    const waitingOnMessageIndex = useRecoilValue(aiAssistantWaitingOnMessageIndexAtom);

    const aiModel = useAIModel();
    const fileTypes = useMemo(() => {
      return aiModel.modelConfig.imageSupport ? ['image/*'] : [];
    }, [aiModel.modelConfig.imageSupport]);

    const { submitPrompt } = useSubmitAIAssistantPrompt();
    const handleSubmit = useCallback(
      ({ content }: SubmitPromptArgs) => {
        mixpanel.track('[AIAssistant].submitPrompt');
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
        isFileSupported={(mimeType) => aiModel.modelConfig.imageSupport && isSupportedImageMimeType(mimeType)}
        fileTypes={fileTypes}
        submitPrompt={handleSubmit}
        ctx={{ context: { sheets: [], currentSheet: '', codeCell } }}
        waitingOnMessageIndex={waitingOnMessageIndex}
      />
    );
  })
);
