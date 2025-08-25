import { aiAnalystCurrentChatAtom, aiAnalystLoadingAtom } from '@/app/atoms/aiAnalystAtom';
import { useDebugFlags } from '@/app/debugFlags/useDebugFlags';
import { Textarea } from '@/shared/shadcn/ui/textarea';
import { getMessagesForAI } from 'quadratic-shared/ai/helpers/message.helper';
import { ChatMessagesSchema } from 'quadratic-shared/typesAndSchemasAI';
import { memo, useCallback, useMemo, useState } from 'react';
import { useRecoilState, useRecoilValue } from 'recoil';

export const AIAnalystDebugChatInput = memo(() => {
  const { debug, debugFlags } = useDebugFlags();
  const debugAIAnalystChatStringInput = useMemo(
    () => debugFlags.getFlag('debugAIAnalystChatStringInput'),
    [debugFlags]
  );
  const loading = useRecoilValue(aiAnalystLoadingAtom);
  const [currentChat, setCurrentChat] = useRecoilState(aiAnalystCurrentChatAtom);
  const [error, setError] = useState<string | null>(null);

  const chatString = useMemo(
    () => (currentChat.messages.length > 0 ? JSON.stringify(getMessagesForAI(currentChat.messages)) : ''),
    [currentChat.messages]
  );

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      try {
        setError(null);
        const newValue = e.target.value.trim();
        if (!newValue) {
          setCurrentChat((prev) => ({ id: '', name: '', lastUpdated: Date.now(), messages: [] }));
          return;
        }

        const parsedMessages = JSON.parse(newValue);
        const messages = ChatMessagesSchema.parse(parsedMessages);
        setCurrentChat((prev) => ({ id: '', name: '', lastUpdated: Date.now(), messages }));
      } catch (error) {
        console.error(error);
        setError(`Invalid chat string: ${error}`);
        setCurrentChat((prev) => ({ id: '', name: '', lastUpdated: Date.now(), messages: [] }));
      }
    },
    [setCurrentChat]
  );

  if (!debug || !debugAIAnalystChatStringInput) {
    return null;
  }

  return (
    <div className="mb-2 border-b border-t border-border px-2 pt-2">
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

      {error && <p className="max-h-32 overflow-y-auto text-red-500">{error}</p>}
    </div>
  );
});
