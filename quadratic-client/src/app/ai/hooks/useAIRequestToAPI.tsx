import { authClient } from '@/auth/auth';
import { apiClient } from '@/shared/api/apiClient';
import { getModelOptions } from 'quadratic-shared/ai/helpers/model.helper';
import {
  AIAutoCompleteRequestBody,
  AIMessagePrompt,
  AIMessagePromptSchema,
  ChatMessage,
} from 'quadratic-shared/typesAndSchemasAI';
import { useCallback } from 'react';
import { SetterOrUpdater } from 'recoil';

type HandleAIPromptProps = AIAutoCompleteRequestBody & {
  setMessages?: SetterOrUpdater<ChatMessage[]> | ((value: React.SetStateAction<ChatMessage[]>) => void);
  signal: AbortSignal;
};

export function useAIRequestToAPI() {
  const handleAIRequestToAPI = useCallback(
    async ({
      setMessages,
      signal,
      ...args
    }: HandleAIPromptProps): Promise<{
      error?: boolean;
      content: AIMessagePrompt['content'];
      toolCalls: AIMessagePrompt['toolCalls'];
    }> => {
      let responseMessage: AIMessagePrompt = {
        role: 'assistant',
        content: '',
        contextType: 'userPrompt',
        toolCalls: [],
      };
      setMessages?.((prev) => [...prev, { ...responseMessage, content: '' }]);
      const { model, useStream, useTools } = args;

      try {
        const endpoint = `${apiClient.getApiUrl()}/ai`;
        const token = await authClient.getTokenOrRedirect();
        const response = await fetch(endpoint, {
          method: 'POST',
          signal,
          headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
          body: JSON.stringify(args),
        });

        if (!response.ok) {
          const data = await response.json();
          const error =
            response.status === 429
              ? 'You have exceeded the maximum number of requests. Please try again later.'
              : `Looks like there was a problem. Error: ${data}`;
          setMessages?.((prev) => [
            ...prev.slice(0, -1),
            { role: 'assistant', content: error, contextType: 'userPrompt', model, toolCalls: [] },
          ]);
          console.error(`Error retrieving data from AI API. Error: ${data}`);
          return { error: true, content: error, toolCalls: [] };
        }

        const { stream } = getModelOptions(model, { useTools, useStream });

        // handle streaming response
        if (stream) {
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
                const newResponseMessage = AIMessagePromptSchema.parse(JSON.parse(line.slice(6)));
                setMessages?.((prev) => [...prev.slice(0, -1), { ...newResponseMessage }]);
                responseMessage = newResponseMessage;
              }
            }
          }

          return { content: responseMessage.content, toolCalls: responseMessage.toolCalls };
        }

        // handle non-streaming response
        else {
          const data = await response.json();
          const newResponseMessage = AIMessagePromptSchema.parse(data);
          setMessages?.((prev) => [...prev.slice(0, -1), { ...newResponseMessage }]);
          responseMessage = newResponseMessage;

          return { content: responseMessage.content, toolCalls: responseMessage.toolCalls };
        }
      } catch (err: any) {
        if (err.name === 'AbortError') {
          return { error: false, content: 'Aborted by user', toolCalls: [] };
        } else {
          responseMessage.content += '\n\nAn error occurred while processing the response.';
          setMessages?.((prev) => [...prev.slice(0, -1), { ...responseMessage }]);
          console.error('Error in AI prompt handling:', err);
          return { error: true, content: 'An error occurred while processing the response.', toolCalls: [] };
        }
      }
    },
    []
  );

  return { handleAIRequestToAPI };
}
