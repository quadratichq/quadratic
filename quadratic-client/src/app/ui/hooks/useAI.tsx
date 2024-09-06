import { authClient } from '@/auth';
import { apiClient } from '@/shared/api/apiClient';
import { AIMessage } from 'quadratic-shared/typesAndSchemasAI';
import { useCallback } from 'react';

type HandleAIStreamProps = {
  model?: string;
  systemMessages: AIMessage[];
  messages: AIMessage[];
  setMessages: (value: React.SetStateAction<AIMessage[]>) => void;
  signal: AbortSignal;
};

type HandleAIAssistProps = {
  model?: string;
  systemMessages: AIMessage[];
  messages: AIMessage[];
  signal: AbortSignal;
};

export function useAI() {
  const handleAIStream = useCallback(
    async ({ model, systemMessages, messages, setMessages, signal }: HandleAIStreamProps) => {
      let responseMessage: AIMessage = { role: 'assistant', content: '' };

      try {
        const token = await authClient.getTokenOrRedirect();
        const response = await fetch(`${apiClient.getApiUrl()}/ai/chat/stream`, {
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
          const errorMessage =
            response.status === 429
              ? 'You have exceeded the maximum number of requests. Please try again later.'
              : `Looks like there was a problem. Status Code: ${response.status}`;
          setMessages((prev) => [...prev, { role: 'assistant', content: errorMessage }]);
          if (response.status !== 429) {
            console.error(`Error retrieving data from AI API: ${response.status}`);
          }
          return;
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
      } catch (err: any) {
        if (err.name !== 'AbortError') {
          console.error('Error in AI prompt handling:', err);
          if (responseMessage) {
            responseMessage.content += '\n\nAn error occurred while processing the response.';
            setMessages((prev) => [...prev.slice(0, -1), { ...responseMessage }]);
          }
        }
      }
    },
    []
  );

  const handleAIAssist = useCallback(
    async ({
      model,
      systemMessages,
      messages,
      signal,
    }: HandleAIAssistProps): Promise<{ error?: boolean; content: string }> => {
      try {
        const token = await authClient.getTokenOrRedirect();
        const response = await fetch(`${apiClient.getApiUrl()}/ai/chat/assist`, {
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
          if (response.status !== 429) {
            console.error(`Error retrieving data from AI API: ${response.status}`);
          }
          return { error: true, content: error };
        }
        const content = await response.json();
        return { content };
      } catch (err: any) {
        if (err.name === 'AbortError') {
          return { error: false, content: 'Aborted by user' };
        } else {
          console.error('Error in AI prompt handling:', err);
          return { error: true, content: 'An error occurred while processing the response.' };
        }
      }
    },
    []
  );

  return { handleAIStream, handleAIAssist };
}
