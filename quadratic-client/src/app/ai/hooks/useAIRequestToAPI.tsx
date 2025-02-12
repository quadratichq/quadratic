import { editorInteractionStateFileUuidAtom } from '@/app/atoms/editorInteractionStateAtom';
import { authClient } from '@/auth/auth';
import { apiClient } from '@/shared/api/apiClient';
import { getModelOptions } from 'quadratic-shared/ai/helpers/model.helper';
import {
  AIMessagePromptSchema,
  type AIMessagePrompt,
  type AIRequestBody,
  type ChatMessage,
} from 'quadratic-shared/typesAndSchemasAI';
import type { SetterOrUpdater } from 'recoil';
import { useRecoilCallback } from 'recoil';

type HandleAIPromptProps = Omit<AIRequestBody, 'fileUuid'> & {
  setMessages?: SetterOrUpdater<ChatMessage[]> | ((value: React.SetStateAction<ChatMessage[]>) => void);
  signal: AbortSignal;
};

export function useAIRequestToAPI() {
  const handleAIRequestToAPI = useRecoilCallback(
    ({ snapshot }) =>
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
          model: args.model,
        };
        setMessages?.((prev) => [...prev, { ...responseMessage, content: '' }]);
        const { model, useStream, useTools } = args;
        const fileUuid = await snapshot.getPromise(editorInteractionStateFileUuidAtom);

        try {
          const endpoint = `${apiClient.getApiUrl()}/v0/ai/chat`;
          const token = await authClient.getTokenOrRedirect();
          const response = await fetch(endpoint, {
            method: 'POST',
            signal,
            headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ ...args, fileUuid }),
          });

          if (!response.ok) {
            const data = await response.json();
            const error = (() => {
              switch (response.status) {
                case 429:
                  return 'You have exceeded the maximum number of requests. Please try again later.';
                case 402:
                  return 'You have exceeded your AI message limit. Please upgrade your plan to continue.';
                default:
                  return `Looks like there was a problem. Error: ${data.error}`;
              }
            })();
            setMessages?.((prev) => [
              ...prev.slice(0, -1),
              { role: 'assistant', content: error, contextType: 'userPrompt', model, toolCalls: [] },
            ]);
            console.error(`Error retrieving data from AI API. Error: ${data}`);
            return { error: true, content: error, toolCalls: [] };
          }

          const { stream } = getModelOptions(model, { useTools, useStream });

          if (stream) {
            // handle streaming response

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
                    const newResponseMessage = AIMessagePromptSchema.parse(JSON.parse(line.slice(6)));
                    setMessages?.((prev) => [...prev.slice(0, -1), { ...newResponseMessage }]);
                    responseMessage = newResponseMessage;
                  } catch (error) {
                    console.error('Error parsing AI response: ', { error, line, lines });
                  }
                }
              }
            }

            return { content: responseMessage.content, toolCalls: responseMessage.toolCalls };
          } else {
            // handle non-streaming response

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
