import { Action } from '@/app/actions/actions';
import {
  aiAnalystAbortControllerAtom,
  aiAnalystCurrentChatUserMessagesCountAtom,
  aiAnalystImportFilesToGridLoadingAtom,
  aiAnalystLoadingAtom,
  aiAnalystWaitingOnMessageIndexAtom,
  showAIAnalystAtom,
} from '@/app/atoms/aiAnalystAtom';
import { events } from '@/app/events/events';
import { matchShortcut } from '@/app/helpers/keyboardShortcuts';
import type { AIUserMessageFormWrapperProps, SubmitPromptArgs } from '@/app/ui/components/AIUserMessageForm';
import { AIUserMessageForm } from '@/app/ui/components/AIUserMessageForm';
import { defaultAIAnalystContext } from '@/app/ui/menus/AIAnalyst/const/defaultAIAnalystContext';
import { useSubmitAIAnalystPrompt } from '@/app/ui/menus/AIAnalyst/hooks/useSubmitAIAnalystPrompt';
import { trackEvent } from '@/shared/utils/analyticsEvents';
import { isSupportedImageMimeType, isSupportedPdfMimeType } from 'quadratic-shared/ai/helpers/files.helper';
import type { Context } from 'quadratic-shared/typesAndSchemasAI';
import type { ConnectionType } from 'quadratic-shared/typesAndSchemasConnections';
import { forwardRef, memo, useEffect, useState } from 'react';
import { useRecoilCallback, useRecoilState, useRecoilValue } from 'recoil';

const ANALYST_FILE_TYPES = ['image/*', '.pdf'];
const IMPORT_FILE_TYPES = ['.xlsx', '.xls', '.csv', '.parquet', '.parq', '.pqt'];
const ALL_FILE_TYPES = [...ANALYST_FILE_TYPES, ...IMPORT_FILE_TYPES];

export const AIAnalystUserMessageForm = memo(
  forwardRef<HTMLTextAreaElement, AIUserMessageFormWrapperProps>((props: AIUserMessageFormWrapperProps, ref) => {
    const [context, setContext] = useState<Context>(props.initialContext ?? defaultAIAnalystContext);
    const abortController = useRecoilValue(aiAnalystAbortControllerAtom);
    const [loading, setLoading] = useRecoilState(aiAnalystLoadingAtom);
    const importFilesToGridLoading = useRecoilValue(aiAnalystImportFilesToGridLoadingAtom);
    const waitingOnMessageIndex = useRecoilValue(aiAnalystWaitingOnMessageIndexAtom);
    const { submitPrompt } = useSubmitAIAnalystPrompt();

    // Listen for connection selection events (from connections menu)
    useEffect(() => {
      const handleSelectConnection = (connectionUuid: string, connectionType: string, connectionName: string) => {
        setContext((prev) => ({
          ...prev,
          connection: {
            type: connectionType as ConnectionType,
            id: connectionUuid,
            name: connectionName,
          },
        }));
      };

      events.on('aiAnalystSelectConnection', handleSelectConnection);
      return () => {
        events.off('aiAnalystSelectConnection', handleSelectConnection);
      };
    }, []);

    const handleSubmit = useRecoilCallback(
      ({ snapshot }) =>
        async ({ content, context, importFiles }: SubmitPromptArgs) => {
          const userMessagesCount = await snapshot.getPromise(aiAnalystCurrentChatUserMessagesCountAtom);
          trackEvent('[AIAnalyst].submitPrompt', {
            userMessageCountUponSubmit: userMessagesCount,
            language: context.connection?.type,
          });

          submitPrompt({
            messageSource: 'User',
            content,
            context,
            messageIndex: props.messageIndex,
            importFiles,
          });

          if (!props.initialContext) {
            setContext((prev) => ({ ...prev, connection: undefined }));
          }
        },
      [props.initialContext, props.messageIndex, submitPrompt]
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
      <div className="flex flex-col justify-end gap-2">
        <AIUserMessageForm
          {...props}
          ref={ref}
          abortController={abortController}
          loading={loading}
          setLoading={setLoading}
          cancelDisabled={importFilesToGridLoading}
          context={context}
          setContext={setContext}
          isChatFileSupported={(mimeType) => isSupportedImageMimeType(mimeType) || isSupportedPdfMimeType(mimeType)}
          isImportFileSupported={(extension) => IMPORT_FILE_TYPES.includes(extension)}
          fileTypes={ALL_FILE_TYPES}
          submitPrompt={handleSubmit}
          formOnKeyDown={formOnKeyDown}
          waitingOnMessageIndex={waitingOnMessageIndex}
          maxHeight="275px"
          filesSupportedText="PDF, Image, CSV, Excel and Parquet"
        />
      </div>
    );
  })
);
