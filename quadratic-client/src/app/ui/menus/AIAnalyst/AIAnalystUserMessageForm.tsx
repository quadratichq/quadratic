import { Action } from '@/app/actions/actions';
import {
  abortControllerAtom,
  aiStore,
  currentChatUserMessagesCountAtom,
  importFilesToGridLoadingAtom,
  loadingAtom,
  showAIAnalystAtom,
  waitingOnMessageIndexAtom,
} from '@/app/ai/atoms/aiAnalystAtoms';
import { events } from '@/app/events/events';
import { matchShortcut } from '@/app/helpers/keyboardShortcuts';
import type { AIUserMessageFormWrapperProps, SubmitPromptArgs } from '@/app/ui/components/AIUserMessageForm';
import { AIUserMessageForm } from '@/app/ui/components/AIUserMessageForm';
import { useConnectionsFetcher } from '@/app/ui/hooks/useConnectionsFetcher';
import { defaultAIAnalystContext } from '@/app/ui/menus/AIAnalyst/const/defaultAIAnalystContext';
import { useSubmitAIAnalystPrompt } from '@/app/ui/menus/AIAnalyst/hooks/useSubmitAIAnalystPrompt';
import { cn } from '@/shared/shadcn/utils';
import { trackEvent } from '@/shared/utils/analyticsEvents';
import { useAtom, useAtomValue } from 'jotai';
import { isSupportedImageMimeType, isSupportedPdfMimeType } from 'quadratic-shared/ai/helpers/files.helper';
import type { Context } from 'quadratic-shared/typesAndSchemasAI';
import type { ConnectionType } from 'quadratic-shared/typesAndSchemasConnections';
import { forwardRef, memo, useCallback, useEffect, useState } from 'react';

const ANALYST_FILE_TYPES = ['image/*', '.pdf'];
const IMPORT_FILE_TYPES = ['.xlsx', '.xls', '.csv', '.parquet', '.parq', '.pqt'];
const ALL_FILE_TYPES = [...ANALYST_FILE_TYPES, ...IMPORT_FILE_TYPES];

export const AIAnalystUserMessageForm = memo(
  forwardRef<HTMLTextAreaElement, AIUserMessageFormWrapperProps>((props: AIUserMessageFormWrapperProps, ref) => {
    const [context, setContext] = useState<Context>(props.initialContext ?? defaultAIAnalystContext);
    const abortController = useAtomValue(abortControllerAtom);
    const [loading, setLoading] = useAtom(loadingAtom);
    const importFilesToGridLoading = useAtomValue(importFilesToGridLoadingAtom);
    const waitingOnMessageIndex = useAtomValue(waitingOnMessageIndexAtom);
    const { submitPrompt } = useSubmitAIAnalystPrompt();
    const { connections } = useConnectionsFetcher();

    // Clear context connection if it was deleted
    useEffect(() => {
      if (context.connection && connections.length > 0 && !connections.some((c) => c.uuid === context.connection?.id)) {
        setContext((prev) => ({ ...prev, connection: undefined }));
      }
    }, [connections, context.connection, setContext]);

    // Listen for connection selection/unselection events (from connections menus)
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

      const handleUnselectConnection = () => {
        setContext((prev) => ({
          ...prev,
          connection: undefined,
        }));
      };

      events.on('aiAnalystSelectConnection', handleSelectConnection);
      events.on('aiAnalystUnselectConnection', handleUnselectConnection);
      return () => {
        events.off('aiAnalystSelectConnection', handleSelectConnection);
        events.off('aiAnalystUnselectConnection', handleUnselectConnection);
      };
    }, []);

    const handleSubmit = useCallback(
      async ({ content, context, importFiles }: SubmitPromptArgs) => {
        const userMessagesCount = aiStore.get(currentChatUserMessagesCountAtom);
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

    const formOnKeyDown = useCallback((event: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (matchShortcut(Action.ToggleAIAnalyst, event)) {
        event.preventDefault();
        const current = aiStore.get(showAIAnalystAtom);
        aiStore.set(showAIAnalystAtom, !current);
      }
    }, []);

    return (
      <div className={cn('flex flex-col justify-end gap-2', props.showEmptyChatPromptSuggestions && 'min-h-0 flex-1')}>
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
