import { MODEL_OPTIONS } from '@/app/ai/MODELS';
import { AITool } from '@/app/ai/tools/aiTools';
import { getToolChoice, getTools, isAnthropicModel } from '@/app/ai/tools/helpers';
import { authClient } from '@/auth';
import { AI } from '@/shared/constants/routes';
import {
  AIMessage,
  AnthropicModel,
  AnthropicPromptMessage,
  OpenAIModel,
  OpenAIPromptMessage,
  UserMessage,
} from 'quadratic-shared/typesAndSchemasAI';
import { useCallback } from 'react';
import { SetterOrUpdater } from 'recoil';

type HandleAIPromptProps = {
  model: AnthropicModel | OpenAIModel;
  messages: AnthropicPromptMessage[] | OpenAIPromptMessage[];
  setMessages?:
    | SetterOrUpdater<(UserMessage | AIMessage)[]>
    | ((value: React.SetStateAction<(UserMessage | AIMessage)[]>) => void);
  signal: AbortSignal;
  useStream?: boolean;
  useTools?: boolean;
  toolChoice?: AITool;
};

export function useAIRequestToAPI() {
  const parseAnthropicStream = useCallback(
    async (
      reader: ReadableStreamDefaultReader<Uint8Array>,
      responseMessage: AIMessage,
      setMessages?: (value: React.SetStateAction<(UserMessage | AIMessage)[]>) => void
    ): Promise<{ error?: boolean; content: AIMessage['content']; functionCalls?: AIMessage['functionCalls'] }> => {
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
              if (data.type === 'content_block_start') {
                if (data.content_block.type === 'text') {
                  responseMessage.content += data.content_block.text;
                } else if (data.content_block.type === 'tool_use') {
                  const functionCalls = [...(responseMessage.functionCalls ?? [])];
                  const functionCall = {
                    id: data.content_block.id,
                    name: data.content_block.name,
                    arguments: '',
                  };
                  functionCalls.push(functionCall);
                  responseMessage.functionCalls = functionCalls;
                }
                setMessages?.((prev) => [...prev.slice(0, -1), { ...responseMessage }]);
              } else if (data.type === 'content_block_delta') {
                if (data.delta.type === 'text_delta') {
                  responseMessage.content += data.delta.text;
                } else if (data.delta.type === 'input_json_delta') {
                  const functionCalls = [...(responseMessage.functionCalls ?? [])];
                  const functionCall = {
                    ...(functionCalls.pop() ?? {
                      id: '',
                      name: '',
                      arguments: '',
                    }),
                  };
                  functionCall.arguments += data.delta.partial_json;
                  functionCalls.push(functionCall);
                  responseMessage.functionCalls = functionCalls;
                }
                setMessages?.((prev) => [...prev.slice(0, -1), { ...responseMessage }]);
              } else if (data.type === 'message_start') {
                // message start
              } else if (data.type === 'message_stop') {
                // message stop
              } else if (data.type === 'error') {
                responseMessage.content += '\n\nAn error occurred while processing the response.';
                setMessages?.((prev) => [...prev.slice(0, -1), { ...responseMessage }]);
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

      if (!responseMessage.content) {
        responseMessage.content = responseMessage.functionCalls ? '' : "I'm sorry, I don't have a response for that.";
        setMessages?.((prev) => [...prev.slice(0, -1), { ...responseMessage }]);
      }

      return { content: responseMessage.content, functionCalls: responseMessage.functionCalls };
    },
    []
  );

  const parseOpenAIStream = useCallback(
    async (
      reader: ReadableStreamDefaultReader<Uint8Array>,
      responseMessage: AIMessage,
      setMessages?: (value: React.SetStateAction<(UserMessage | AIMessage)[]>) => void
    ): Promise<{ error?: boolean; content: AIMessage['content']; functionCalls?: AIMessage['functionCalls'] }> => {
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
              if (data.choices && data.choices[0] && data.choices[0].delta) {
                if (data.choices[0].delta.content) {
                  responseMessage.content += data.choices[0].delta.content;
                  setMessages?.((prev) => [...prev.slice(0, -1), { ...responseMessage }]);
                } else if (data.choices[0].delta.tool_calls) {
                  data.choices[0].delta.tool_calls.forEach(
                    (tool_call: { id: string; function: { name?: string; arguments: string } }) => {
                      const functionCalls = [...(responseMessage.functionCalls ?? [])];
                      if (tool_call.function.name) {
                        const functionCall = {
                          id: tool_call.id,
                          name: tool_call.function.name,
                          arguments: tool_call.function.arguments,
                        };
                        functionCalls.push(functionCall);
                      } else {
                        const functionCall = {
                          ...(functionCalls.pop() ?? {
                            id: '',
                            name: '',
                            arguments: '',
                          }),
                        };
                        functionCall.arguments += tool_call?.function?.arguments ?? '';
                        functionCalls.push(functionCall);
                      }
                      responseMessage.functionCalls = functionCalls;
                    }
                  );
                  setMessages?.((prev) => [...prev.slice(0, -1), { ...responseMessage }]);
                } else if (data.choices[0].delta.refusal) {
                  console.warn('Invalid AI response: ', data.choices[0].delta.refusal);
                }
              } else if (data.error) {
                responseMessage.content += '\n\nAn error occurred while processing the response.';
                setMessages?.((prev) => [...prev.slice(0, -1), { ...responseMessage }]);
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

      if (!responseMessage.content) {
        responseMessage.content = responseMessage.functionCalls ? '' : "I'm sorry, I don't have a response for that.";
        setMessages?.((prev) => [...prev.slice(0, -1), { ...responseMessage }]);
      }

      return { content: responseMessage.content, functionCalls: responseMessage.functionCalls };
    },
    []
  );

  const handleAIRequestToAPI = useCallback(
    async ({
      model,
      messages,
      setMessages,
      signal,
      useStream,
      useTools,
      toolChoice,
    }: HandleAIPromptProps): Promise<{
      error?: boolean;
      content: AIMessage['content'];
      functionCalls?: AIMessage['functionCalls'];
    }> => {
      const responseMessage: AIMessage = {
        role: 'assistant',
        content: '',
        model,
        internalContext: false,
        contextType: 'userPrompt',
      };
      setMessages?.((prev) => [...prev, { ...responseMessage, content: 'Loading...' }]);

      try {
        const token = await authClient.getTokenOrRedirect();
        const isAnthropic = isAnthropicModel(model);
        const { stream: streamDefault, temperature } = MODEL_OPTIONS[model];
        const stream = useStream ?? streamDefault;
        const endpoint = isAnthropic ? AI.ANTHROPIC[stream ? 'STREAM' : 'CHAT'] : AI.OPENAI[stream ? 'STREAM' : 'CHAT'];
        const tools = !useTools ? undefined : getTools(model);
        const tool_choice = !useTools ? undefined : getToolChoice(model, toolChoice);
        const response = await fetch(endpoint, {
          method: 'POST',
          signal,
          headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ model, messages, temperature, tools, tool_choice }),
        });

        if (!response.ok) {
          const error =
            response.status === 429
              ? 'You have exceeded the maximum number of requests. Please try again later.'
              : `Looks like there was a problem. Status Code: ${response.status}`;
          setMessages?.((prev) => [
            ...prev.slice(0, -1),
            { role: 'assistant', content: error, model, internalContext: false, contextType: 'userPrompt' },
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
            data?.forEach(
              (
                message: { type: 'text'; text: string } | { type: 'tool_use'; id: string; name: string; input: unknown }
              ) => {
                switch (message.type) {
                  case 'text':
                    responseMessage.content += message.text;
                    setMessages?.((prev) => [...prev.slice(0, -1), { ...responseMessage }]);
                    break;
                  case 'tool_use':
                    responseMessage.functionCalls = [
                      ...(responseMessage.functionCalls ?? []),
                      {
                        id: message.id,
                        name: message.name,
                        arguments: JSON.stringify(message.input),
                      },
                    ];
                    break;
                  default:
                    console.error(`Invalid AI response: ${JSON.stringify(message)}`);
                }
              }
            );
          } else {
            if (data) {
              if (data.content) {
                responseMessage.content += data.content;
                setMessages?.((prev) => [...prev.slice(0, -1), { ...responseMessage }]);
              } else if (data.tool_calls) {
                data.tool_calls.forEach(
                  (toolCall: { type: string; id: string; function: { name: string; arguments: string } }) => {
                    switch (toolCall.type) {
                      case 'function':
                        responseMessage.functionCalls = [
                          ...(responseMessage.functionCalls ?? []),
                          {
                            id: toolCall.id,
                            name: toolCall.function.name,
                            arguments: toolCall.function.arguments,
                          },
                        ];
                        break;
                      default:
                        throw new Error(`Invalid AI response: ${data}`);
                    }
                  }
                );
              } else if (data.refusal) {
                throw new Error(`Invalid AI response: ${data}`);
              }
            }
          }

          if (!responseMessage.content) {
            responseMessage.content = responseMessage.functionCalls
              ? ''
              : "I'm sorry, I don't have a response for that.";
            setMessages?.((prev) => [...prev.slice(0, -1), { ...responseMessage }]);
          }

          return { content: responseMessage.content, functionCalls: responseMessage.functionCalls };
        }
      } catch (err: any) {
        if (err.name === 'AbortError') {
          return { error: false, content: 'Aborted by user' };
        } else {
          responseMessage.content += '\n\nAn error occurred while processing the response.';
          setMessages?.((prev) => [...prev.slice(0, -1), { ...responseMessage }]);
          console.error('Error in AI prompt handling:', err);
          return { error: true, content: 'An error occurred while processing the response.' };
        }
      }
    },
    [parseAnthropicStream, parseOpenAIStream]
  );

  return { handleAIRequestToAPI };
}
