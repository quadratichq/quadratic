import { aiAnalystCurrentChatAtom, aiAnalystLoadingAtom } from '@/app/atoms/aiAnalystAtom';
import { useDebugFlags } from '@/app/debugFlags/useDebugFlags';
import { Textarea } from '@/shared/shadcn/ui/textarea';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/shared/shadcn/ui/tooltip';
import { ChatMessagesSchema } from 'quadratic-shared/typesAndSchemasAI';
import { memo, useCallback, useMemo, useState } from 'react';
import { useRecoilState, useRecoilValue } from 'recoil';

export const AIAnalystDebugChatInput = memo(() => {
  const { debug, debugFlags } = useDebugFlags();
  const debugAIAnalystDebugChatInput = useMemo(() => debugFlags.getFlag('debugAIAnalystDebugChatInput'), [debugFlags]);
  const loading = useRecoilValue(aiAnalystLoadingAtom);
  const [currentChat, setCurrentChat] = useRecoilState(aiAnalystCurrentChatAtom);
  const [error, setError] = useState<string | null>(null);
  const [showCopied, setShowCopied] = useState(false);

  const chatString = useMemo(
    () => (currentChat.messages.length > 0 ? JSON.stringify(currentChat.messages) : ''),
    [currentChat.messages]
  );

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      try {
        setError(null);
        const newValue = e.target.value.trim();
        if (!newValue) {
          setCurrentChat((prev) => ({ ...prev, messages: [] }));
          return;
        }

        const parsedMessages = JSON.parse(newValue);
        const messages = ChatMessagesSchema.parse(parsedMessages);
        setCurrentChat((prev) => ({ ...prev, messages }));
      } catch (error) {
        console.error(error);
        setError(`Invalid chat string: ${error}`);
        setCurrentChat((prev) => ({ ...prev, messages: [] }));
      }
    },
    [setCurrentChat]
  );

  const handleCopy = useCallback(
    (event: React.MouseEvent<HTMLButtonElement>) => {
      if (!chatString || error !== null) {
        return;
      }
      event.preventDefault();
      navigator.clipboard.writeText(chatString);
      setShowCopied(true);
      setTimeout(() => setShowCopied(false), 1000);
    },
    [chatString, error]
  );

  if (!debug || !debugAIAnalystDebugChatInput) {
    return null;
  }

  return (
    <div className="mb-2 border-b border-t border-border px-2 pt-2">
      <Tooltip open={showCopied}>
        <TooltipTrigger onClick={handleCopy} asChild>
          <Textarea
            className="sticky top-0.5 z-10 bg-background"
            autoComplete="off"
            value={chatString}
            onChange={handleChange}
            disabled={loading}
            placeholder="Chat String"
            autoHeight={true}
            maxHeight={'120px'}
          />
        </TooltipTrigger>
        <TooltipContent>Copied</TooltipContent>
      </Tooltip>

      {error && <p className="max-h-32 overflow-y-auto text-red-500">{error}</p>}
    </div>
  );
});
