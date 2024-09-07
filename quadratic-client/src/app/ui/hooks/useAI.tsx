import { authClient } from '@/auth';
import { AI } from '@/shared/constants/routes';
import { AIMessage, AIModel } from 'quadratic-shared/typesAndSchemasAI';
import { useCallback } from 'react';

type HandleAIPromptProps = {
  type: 'stream' | 'assist';
  model?: AIModel;
  systemMessages: AIMessage[];
  messages: AIMessage[];
  setMessages: (value: React.SetStateAction<AIMessage[]>) => void;
  signal: AbortSignal;
};

export function useAI() {
  const handleAIStream = useCallback(
    async ({
      type,
      model,
      systemMessages,
      messages,
      setMessages,
      signal,
    }: HandleAIPromptProps): Promise<{ error?: boolean; content: string }> => {
      let responseMessage: AIMessage = { role: 'assistant', content: '' };
      try {
        const token = await authClient.getTokenOrRedirect();
        const url = type === 'assist' ? AI.ASSIST : AI.STREAM;
        const response = await fetch(url, {
          method: 'POST',
          signal,
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model,
            messages: [...systemMessages, ...messages],
          }),
        });

        if (!response.ok) {
          const error =
            response.status === 429
              ? 'You have exceeded the maximum number of requests. Please try again later.'
              : `Looks like there was a problem. Status Code: ${response.status}`;
          setMessages((prev) => [...prev, { role: 'assistant', content: error }]);
          if (response.status !== 429) {
            console.error(`Error retrieving data from AI API: ${response.status}`);
          }
          return { error: true, content: error };
        }

        setMessages((prev) => [...prev, responseMessage]);

        const reader = response.body?.getReader();
        if (!reader) throw new Error('Response body is not readable');

        const decoder = new TextDecoder();

        while (true) {
          const { value, done } = await reader.read();
          if (done) break;

          const chunk = decoder.decode(value, { stream: true });
          const lines = chunk.split('\n');

          for (const line of lines) {
            if (line.startsWith('data: ')) {
              try {
                const data = JSON.parse(line.slice(6));
                if (data.choices[0].delta.content) {
                  responseMessage.content += data.choices[0].delta.content;
                  setMessages((prev) => [...prev.slice(0, -1), { ...responseMessage }]);
                }
              } catch (err) {
                // Not JSON or unexpected format, skip
              }
            }
          }
        }
        return { content: responseMessage.content };
      } catch (err: any) {
        if (err.name === 'AbortError') {
          return { error: false, content: 'Aborted by user' };
        } else {
          responseMessage.content += '\n\nAn error occurred while processing the response.';
          setMessages((prev) => [...prev.slice(0, -1), { ...responseMessage }]);
          console.error('Error in AI prompt handling:', err);
          return { error: true, content: 'An error occurred while processing the response.' };
        }
      }
    },
    []
  );

  return handleAIStream;
}
