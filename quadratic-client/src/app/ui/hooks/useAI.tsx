import { authClient } from '@/auth';
import { AI } from '@/shared/constants/routes';
import {
  AIMessage,
  AnthropicMessage,
  AnthropicModel,
  AnthropicModelSchema,
  OpenAIMessage,
  OpenAIModel,
  UserMessage,
} from 'quadratic-shared/typesAndSchemasAI';
import { useCallback } from 'react';

type HandleOpenAIPromptProps = {
  model: OpenAIModel;
  messages: OpenAIMessage[];
  setMessages: (value: React.SetStateAction<(UserMessage | AIMessage)[]>) => void;
  signal: AbortSignal;
};

type HandleAnthropicAIPromptProps = {
  model: AnthropicModel;
  messages: AnthropicMessage[];
  setMessages: (value: React.SetStateAction<(UserMessage | AIMessage)[]>) => void;
  signal: AbortSignal;
};

export function useAI() {
  const isAnthropicModel = useCallback((model: AnthropicModel | OpenAIModel): model is AnthropicModel => {
    return AnthropicModelSchema.safeParse(model).success;
  }, []);

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

  const handleAIStream = useCallback(
    async ({
      model,
      messages,
      setMessages,
      signal,
    }: HandleOpenAIPromptProps | HandleAnthropicAIPromptProps): Promise<{ error?: boolean; content: string }> => {
      let responseMessage: AIMessage = { role: 'assistant', content: '', model };
      const isAnthropic = isAnthropicModel(model);
      try {
        const token = await authClient.getTokenOrRedirect();
        const endpoint = isAnthropic ? AI.ANTHROPIC.STREAM : AI.OPENAI.STREAM;
        const response = await fetch(endpoint, {
          method: 'POST',
          signal,
          headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ model, messages }),
        });

        if (!response.ok) {
          const error =
            response.status === 429
              ? 'You have exceeded the maximum number of requests. Please try again later.'
              : `Looks like there was a problem. Status Code: ${response.status}`;
          setMessages((prev) => [...prev, { role: 'assistant', content: error, model }]);
          if (response.status !== 429) {
            console.error(`Error retrieving data from AI API: ${response.status}`);
          }
          return { error: true, content: error };
        }

        setMessages((prev) => [...prev, responseMessage]);

        const reader = response.body?.getReader();
        if (!reader) throw new Error('Response body is not readable');

        if (isAnthropic) {
          return parseAnthropicStream(reader, responseMessage, setMessages);
        } else {
          return parseOpenAIStream(reader, responseMessage, setMessages);
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
    [isAnthropicModel, parseAnthropicStream, parseOpenAIStream]
  );

  return { handleAIStream, isAnthropicModel };
}
