import { MODEL_OPTIONS } from '@/app/ui/menus/AIAssistant/MODELS';
import { authClient } from '@/auth/auth';
import { AI } from '@/shared/constants/routes';
import {
  AIMessage,
  AnthropicModel,
  AnthropicModelSchema,
  OpenAIModel,
  PromptMessage,
  UserMessage,
} from 'quadratic-shared/typesAndSchemasAI';
import { useCallback } from 'react';
import { SetterOrUpdater } from 'recoil';

export function isAnthropicModel(model: AnthropicModel | OpenAIModel): model is AnthropicModel {
  return AnthropicModelSchema.safeParse(model).success;
}

type HandleAIPromptProps = {
  model: AnthropicModel | OpenAIModel;
  messages: PromptMessage[];
  setMessages:
    | SetterOrUpdater<(UserMessage | AIMessage)[]>
    | ((value: React.SetStateAction<(UserMessage | AIMessage)[]>) => void);
  signal: AbortSignal;
};

export function useAIRequestToAPI() {
  const parseOpenAIStream = useCallback(
    async (
      reader: ReadableStreamDefaultReader<Uint8Array>,
      responseMessage: AIMessage,
      setMessages: (value: React.SetStateAction<(UserMessage | AIMessage)[]>) => void
    ): Promise<{ error?: boolean; content: string }> => {
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
              if (data.choices && data.choices[0] && data.choices[0].delta && data.choices[0].delta.content) {
                responseMessage.content += data.choices[0].delta.content;
                setMessages((prev) => [...prev.slice(0, -1), { ...responseMessage }]);
              } else if (data.error) {
                responseMessage.content += '\n\nAn error occurred while processing the response.';
                setMessages((prev) => [...prev.slice(0, -1), { ...responseMessage }]);
                console.error('Error in AI prompt handling:', data.error);
                return { error: true, content: 'An error occurred while processing the response.' };
              }
            } catch (error) {
              console.error('Error in AI prompt handling:', error);
              // Not JSON or unexpected format, skip
            }
          }
        }
      }
      return { content: responseMessage.content };
    },
    []
  );

  const parseAnthropicStream = useCallback(
    async (
      reader: ReadableStreamDefaultReader<Uint8Array>,
      responseMessage: AIMessage,
      setMessages: (value: React.SetStateAction<(UserMessage | AIMessage)[]>) => void
    ): Promise<{ error?: boolean; content: string }> => {
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
              if (data.type === 'content_block_delta') {
                responseMessage.content += data.delta.text;
                setMessages((prev) => [...prev.slice(0, -1), { ...responseMessage }]);
              } else if (data.type === 'message_start') {
                // message start
              } else if (data.type === 'message_stop') {
                // message stop
              } else if (data.type === 'error') {
                responseMessage.content += '\n\nAn error occurred while processing the response.';
                setMessages((prev) => [...prev.slice(0, -1), { ...responseMessage }]);
                console.error('Error in AI prompt handling:', data.error);
                return { error: true, content: 'An error occurred while processing the response.' };
              }
            } catch (error) {
              console.error('Error in AI prompt handling:', error);
              // Not JSON or unexpected format, skip
            }
          }
        }
      }
      return { content: responseMessage.content };
    },
    []
  );

  const handleAIRequestToAPI = useCallback(
    async ({
      model,
      messages,
      setMessages,
      signal,
    }: HandleAIPromptProps): Promise<{ error?: boolean; content: string }> => {
      const responseMessage: AIMessage = { role: 'assistant', content: '', model, internalContext: false };
      setMessages((prev) => [...prev, { ...responseMessage, content: 'Loading...' }]);

      try {
        const isAnthropic = isAnthropicModel(model);
        const { stream, temperature } = MODEL_OPTIONS[model];
        const token = await authClient.getTokenOrRedirect();
        const endpoint = isAnthropic ? AI.ANTHROPIC[stream ? 'STREAM' : 'CHAT'] : AI.OPENAI[stream ? 'STREAM' : 'CHAT'];
        const response = await fetch(endpoint, {
          method: 'POST',
          signal,
          headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ model, messages, temperature }),
        });

        if (!response.ok) {
          const error =
            response.status === 429
              ? 'You have exceeded the maximum number of requests. Please try again later.'
              : `Looks like there was a problem. Status Code: ${response.status}`;
          setMessages((prev) => [
            ...prev.slice(0, -1),
            { role: 'assistant', content: error, model, internalContext: false },
          ]);
          if (response.status !== 429) {
            console.error(`Error retrieving data from AI API: ${response.status}`);
          }
          return { error: true, content: error };
        }

        if (stream) {
          const reader = response.body?.getReader();
          if (!reader) throw new Error('Response body is not readable');
          if (isAnthropic) {
            return parseAnthropicStream(reader, responseMessage, setMessages);
          } else {
            return parseOpenAIStream(reader, responseMessage, setMessages);
          }
        } else {
          const data = await response.json();
          if (isAnthropic) {
            if (data && data.type === 'text') {
              responseMessage.content += data.text;
              setMessages((prev) => [...prev.slice(0, -1), { ...responseMessage }]);
            } else {
              throw new Error(`Invalid response: ${data}`);
            }
          } else {
            if (data.refusal) {
              throw new Error(data.refusal);
            } else if (data && data.content) {
              responseMessage.content += data.content;
              setMessages((prev) => [...prev.slice(0, -1), { ...responseMessage }]);
            }
          }
          return { content: responseMessage.content };
        }
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
    [parseAnthropicStream, parseOpenAIStream]
  );

  return handleAIRequestToAPI;
}
