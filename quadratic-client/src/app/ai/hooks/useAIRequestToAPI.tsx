import { editorInteractionStateFileUuidAtom } from '@/app/atoms/editorInteractionStateAtom';
import { authClient } from '@/auth/auth';
import { apiClient } from '@/shared/api/apiClient';
import { getModelFromModelKey, getModelOptions } from 'quadratic-shared/ai/helpers/model.helper';
import {
  AIMessagePromptSchema,
  type AIMessagePrompt,
  type AIRequestBody,
  type ChatMessage,
} from 'quadratic-shared/typesAndSchemasAI';
import type { SetterOrUpdater } from 'recoil';
import { useRecoilCallback } from 'recoil';

export const AI_FREE_TIER_WAIT_TIME_SECONDS = 5;

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
          content: [],
          contextType: 'userPrompt',
          toolCalls: [],
          model: getModelFromModelKey(args.modelKey),
        };
        setMessages?.((prev) => [...prev, { ...responseMessage, content: [] }]);
        const { source, modelKey, useStream } = args;
        const fileUuid = await snapshot.getPromise(editorInteractionStateFileUuidAtom);

        try {
          const { stream } = getModelOptions(modelKey, { source, useStream });

          const endpoint = `${apiClient.getApiUrl()}/v0/ai/chat`;
          const token = await authClient.getTokenOrRedirect();
          const response = await fetch(endpoint, {
            method: 'POST',
            signal,
            headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ ...args, fileUuid }),
          });

          // Log the request in OpenAI fine-tuning format
          const fineTuningFormat = {
            messages: args.messages.map((msg) => {
              // Convert content array to single string
              const contentString = msg.content
                .map((c) => {
                  if ('text' in c && typeof c.text === 'string') {
                    return c.text;
                  }
                  if ('id' in c && typeof c.text === 'string') {
                    return c.text;
                  }
                  return '';
                })
                .filter(Boolean)
                .join('\n');

              const baseMessage = {
                role: msg.role,
                content: contentString,
              };

              // Add tool_calls if present in assistant messages
              if (msg.role === 'assistant' && 'toolCalls' in msg && msg.toolCalls?.length > 0) {
                return {
                  ...baseMessage,
                  tool_calls: msg.toolCalls.map((tool) => ({
                    id: tool.id,
                    type: 'function',
                    function: {
                      name: tool.name,
                      arguments: tool.arguments,
                    },
                  })),
                };
              }

              return baseMessage;
            }),
          };
          console.log('[AI.FineTuningFormat]', JSON.stringify(fineTuningFormat, null, 2));

          if (!response.ok) {
            const data = await response.json();
            let text = '';
            switch (response.status) {
              case 429:
                text = 'You have exceeded the maximum number of requests. Please try again later.';
                break;
              case 402:
                text = 'You have exceeded your AI message limit. Please upgrade your plan to continue.';
                break;
              default:
                text = `Looks like there was a problem. Error: ${JSON.stringify(data.error)}`;
                break;
            }
            setMessages?.((prev) => [
              ...prev.slice(0, -1),
              {
                role: 'assistant',
                content: [{ type: 'text', text }],
                contextType: 'userPrompt',
                model: getModelFromModelKey(args.modelKey),
                toolCalls: [],
              },
            ]);
            console.error(`Error retrieving data from AI API. Error: ${data}`);
            return { error: true, content: [{ type: 'text', text }], toolCalls: [] };
          }

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
                    console.warn('Error parsing AI response: ', { error, line });
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

            // Log the complete conversation in OpenAI fine-tuning format
            const completedFineTuningFormat = {
              messages: args.messages.map((msg) => {
                // Convert content array to single string
                const contentString = msg.content
                  .map((c) => {
                    if ('text' in c && typeof c.text === 'string') {
                      return c.text;
                    }
                    if ('id' in c && typeof c.text === 'string') {
                      return c.text;
                    }
                    return '';
                  })
                  .filter(Boolean)
                  .join('\n');

                const baseMessage = {
                  role: msg.role,
                  content: contentString,
                };

                // Add tool_calls if present in assistant messages
                if (msg.role === 'assistant' && 'toolCalls' in msg && msg.toolCalls?.length > 0) {
                  return {
                    ...baseMessage,
                    tool_calls: msg.toolCalls.map((tool) => ({
                      id: tool.id,
                      type: 'function',
                      function: {
                        name: tool.name,
                        arguments: tool.arguments,
                      },
                    })),
                  };
                }

                return baseMessage;
              }),
            };
            console.log('[AI.CompletedConversation]', JSON.stringify(completedFineTuningFormat, null, 2));

            return { content: responseMessage.content, toolCalls: responseMessage.toolCalls };
          }
        } catch (err: any) {
          if (err.name === 'AbortError') {
            return { error: false, content: [{ type: 'text', text: 'Aborted by user' }], toolCalls: [] };
          } else {
            responseMessage = {
              ...responseMessage,
              content: [
                ...responseMessage.content,
                {
                  type: 'text',
                  text: 'An error occurred while processing the response.',
                },
              ],
            };
            setMessages?.((prev) => [...prev.slice(0, -1), { ...responseMessage }]);
            console.error('Error in AI prompt handling:', err);
            return {
              error: true,
              content: [{ type: 'text', text: 'An error occurred while processing the response.' }],
              toolCalls: [],
            };
          }
        }
      },
    []
  );

  return { handleAIRequestToAPI };
}
