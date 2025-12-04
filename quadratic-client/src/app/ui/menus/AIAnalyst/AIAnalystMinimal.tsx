import { Action } from '@/app/actions/actions';
import {
  aiAnalystAbortControllerAtom,
  aiAnalystCurrentChatMessagesAtom,
  aiAnalystCurrentChatMessagesCountAtom,
  aiAnalystCurrentChatUserMessagesCountAtom,
  aiAnalystLoadingAtom,
  aiAnalystWaitingOnMessageIndexAtom,
  showAIAnalystAtom,
} from '@/app/atoms/aiAnalystAtom';
import { matchShortcut } from '@/app/helpers/keyboardShortcuts';
import type { SubmitPromptArgs } from '@/app/ui/components/AIUserMessageForm';
import { AIUserMessageForm } from '@/app/ui/components/AIUserMessageForm';
import { Markdown } from '@/app/ui/components/Markdown';
import { defaultAIAnalystContext } from '@/app/ui/menus/AIAnalyst/const/defaultAIAnalystContext';
import { useSubmitAIAnalystPrompt } from '@/app/ui/menus/AIAnalyst/hooks/useSubmitAIAnalystPrompt';
import { AIIcon, CloseIcon } from '@/shared/components/Icons';
import { Button } from '@/shared/shadcn/ui/button';
import { trackEvent } from '@/shared/utils/analyticsEvents';
import { isSupportedImageMimeType, isSupportedPdfMimeType } from 'quadratic-shared/ai/helpers/files.helper';
import { isAIPromptMessage, isContentText } from 'quadratic-shared/ai/helpers/message.helper';
import type { Context } from 'quadratic-shared/typesAndSchemasAI';
import { memo, useCallback, useEffect, useRef, useState } from 'react';
import { useRecoilCallback, useRecoilState, useRecoilValue, useSetRecoilState } from 'recoil';

const ANALYST_FILE_TYPES = ['image/*', '.pdf'];
const IMPORT_FILE_TYPES = ['.xlsx', '.xls', '.csv', '.parquet', '.parq', '.pqt'];
const ALL_FILE_TYPES = [...ANALYST_FILE_TYPES, ...IMPORT_FILE_TYPES];

// Message that fades out over time
const FadingMessage = memo(({ text, onFadeComplete }: { text: string; onFadeComplete: () => void }) => {
  const [opacity, setOpacity] = useState(1);
  const [isVisible, setIsVisible] = useState(true);

  useEffect(() => {
    // Start fading after 3 seconds
    const fadeStartTimer = setTimeout(() => {
      setOpacity(0);
    }, 5000);

    // Remove from DOM after fade completes
    const removeTimer = setTimeout(() => {
      setIsVisible(false);
      onFadeComplete();
    }, 8000);

    return () => {
      clearTimeout(fadeStartTimer);
      clearTimeout(removeTimer);
    };
  }, [onFadeComplete]);

  if (!isVisible) return null;

  return (
    <div
      className="duration-[3000ms] max-w-2xl rounded-lg bg-background/95 px-4 py-3 shadow-lg ring-1 ring-border/50 backdrop-blur-sm transition-opacity"
      style={{ opacity }}
    >
      <Markdown text={text} />
    </div>
  );
});

export const AIAnalystMinimal = memo(() => {
  const showAIAnalyst = useRecoilValue(showAIAnalystAtom);
  const setShowAIAnalyst = useSetRecoilState(showAIAnalystAtom);
  const messages = useRecoilValue(aiAnalystCurrentChatMessagesAtom);
  const messagesCount = useRecoilValue(aiAnalystCurrentChatMessagesCountAtom);
  const abortController = useRecoilValue(aiAnalystAbortControllerAtom);
  const [loading, setLoading] = useRecoilState(aiAnalystLoadingAtom);
  const waitingOnMessageIndex = useRecoilValue(aiAnalystWaitingOnMessageIndexAtom);
  const { submitPrompt } = useSubmitAIAnalystPrompt();

  const [context, setContext] = useState<Context>(defaultAIAnalystContext);
  const [displayedMessages, setDisplayedMessages] = useState<Array<{ id: number; text: string }>>([]);
  const lastProcessedIndex = useRef(-1);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Track new assistant messages and add them to displayed messages
  useEffect(() => {
    if (messagesCount > 0) {
      // Find new assistant messages
      for (let i = lastProcessedIndex.current + 1; i < messagesCount; i++) {
        const message = messages[i];
        if (isAIPromptMessage(message)) {
          // Extract text content from the message
          const textContent = message.content
            .filter(isContentText)
            .map((item) => item.text)
            .join('\n');

          if (textContent) {
            setDisplayedMessages((prev) => [...prev, { id: Date.now() + i, text: textContent }]);
          }
        }
        lastProcessedIndex.current = i;
      }
    }
  }, [messages, messagesCount]);

  const handleFadeComplete = useCallback((id: number) => {
    setDisplayedMessages((prev) => prev.filter((msg) => msg.id !== id));
  }, []);

  const handleSubmit = useRecoilCallback(
    ({ snapshot }) =>
      async ({ content, context, importFiles }: SubmitPromptArgs) => {
        const userMessagesCount = await snapshot.getPromise(aiAnalystCurrentChatUserMessagesCountAtom);
        trackEvent('[AIAnalyst].submitPrompt', { userMessageCountUponSubmit: userMessagesCount });

        submitPrompt({
          messageSource: 'User',
          content,
          context,
          messageIndex: messagesCount,
          importFiles,
        });

        setContext((prev) => ({ ...prev, connection: undefined }));
      },
    [messagesCount, submitPrompt]
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

  if (!showAIAnalyst) {
    return null;
  }

  return (
    <div className="pointer-events-none absolute inset-0 z-10 flex flex-col items-center justify-end pb-12">
      {/* Fading messages container */}
      {displayedMessages.length > 0 && (
        <div className="pointer-events-auto mb-4 flex flex-col items-center gap-2">
          {displayedMessages.map((msg) => (
            <FadingMessage key={msg.id} text={msg.text} onFadeComplete={() => handleFadeComplete(msg.id)} />
          ))}
        </div>
      )}

      {/* Chat input */}
      <div className="pointer-events-auto w-full max-w-2xl px-4">
        <div className="relative rounded-xl bg-background/95 shadow-xl ring-1 ring-border backdrop-blur-sm">
          <div className="flex items-center gap-2 border-b border-border/50 px-3 py-2">
            <AIIcon className="h-4 w-4 text-primary" />
            <span className="text-sm font-medium">AI Assistant</span>
            {loading && (
              <div className="flex items-center gap-1.5">
                <div className="h-1.5 w-1.5 animate-pulse rounded-full bg-primary" />
                <span className="text-xs text-muted-foreground">Thinking...</span>
              </div>
            )}
            <Button variant="ghost" size="icon-sm" className="ml-auto h-6 w-6" onClick={() => setShowAIAnalyst(false)}>
              <CloseIcon className="h-4 w-4" />
            </Button>
          </div>
          <div className="p-2">
            <AIUserMessageForm
              ref={textareaRef}
              textareaRef={textareaRef}
              messageIndex={messagesCount}
              abortController={abortController}
              loading={loading}
              setLoading={setLoading}
              cancelDisabled={false}
              context={context}
              setContext={setContext}
              isChatFileSupported={(mimeType) => isSupportedImageMimeType(mimeType) || isSupportedPdfMimeType(mimeType)}
              isImportFileSupported={(extension) => IMPORT_FILE_TYPES.includes(extension)}
              fileTypes={ALL_FILE_TYPES}
              submitPrompt={handleSubmit}
              formOnKeyDown={formOnKeyDown}
              waitingOnMessageIndex={waitingOnMessageIndex}
              maxHeight="150px"
              filesSupportedText="PDF, Image, CSV, Excel and Parquet"
              showEmptyChatPromptSuggestions={false}
              uiContext="analyst-new-chat"
            />
          </div>
        </div>
      </div>
    </div>
  );
});
