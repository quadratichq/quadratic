import { MODEL_OPTIONS } from '@/app/ai/MODELS';
import { AITool } from '@/app/ai/tools/aiTools';
import { getAIProviderEndpoint } from '@/app/ai/tools/endpoint.helper';
import { isAnthropicBedrockModel, isAnthropicModel, isBedrockModel, isOpenAIModel } from '@/app/ai/tools/model.helper';
import { getToolChoice, getTools } from '@/app/ai/tools/tool.helpers';
import { authClient } from '@/auth/auth';
import { AIMessagePrompt, AIModel, AIPromptMessage, ChatMessage } from 'quadratic-shared/typesAndSchemasAI';
import { useCallback } from 'react';
import { SetterOrUpdater } from 'recoil';

type HandleAIPromptProps = {
  model: AIModel;
  system?: string | { text: string }[];
  messages: AIPromptMessage[];
  setMessages?: SetterOrUpdater<ChatMessage[]> | ((value: React.SetStateAction<ChatMessage[]>) => void);
  signal: AbortSignal;
  useStream?: boolean;
  useTools?: boolean;
  toolChoice?: AITool;
};

export function useAIRequestToAPI() {
  const parseBedrockStream = useCallback(
    async (
      reader: ReadableStreamDefaultReader<Uint8Array>,
      responseMessage: AIMessagePrompt,
      setMessages?: (value: React.SetStateAction<ChatMessage[]>) => void
    ): Promise<{ error?: boolean; content: AIMessagePrompt['content']; toolCalls: AIMessagePrompt['toolCalls'] }> => {
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
              // tool use start
              if (
                data &&
                data.contentBlockStart &&
                data.contentBlockStart.start &&
                data.contentBlockStart.start.toolUse
              ) {
                const toolCalls = [...responseMessage.toolCalls];
                const toolCall = {
                  id: data.contentBlockStart.start.toolUse.toolUseId,
                  name: data.contentBlockStart.start.toolUse.name,
                  arguments: '',
                  loading: true,
                };
                toolCalls.push(toolCall);
                responseMessage.toolCalls = toolCalls;
                setMessages?.((prev) => [...prev.slice(0, -1), { ...responseMessage }]);
              }
              // tool use stop
              else if (data && data.contentBlockStop) {
                const toolCalls = [...responseMessage.toolCalls];
                let toolCall = toolCalls.pop();
                if (toolCall) {
                  toolCall = { ...toolCall, loading: false };
                  toolCalls.push(toolCall);
                  responseMessage.toolCalls = toolCalls;
                  setMessages?.((prev) => [...prev.slice(0, -1), { ...responseMessage }]);
                }
              } else if (data && data.contentBlockDelta && data.contentBlockDelta.delta) {
                // text delta
                if ('text' in data.contentBlockDelta.delta) {
                  responseMessage.content += data.contentBlockDelta.delta.text;
                }
                // tool use delta
                else if ('toolUse' in data.contentBlockDelta.delta) {
                  const toolCalls = [...responseMessage.toolCalls];
                  const toolCall = {
                    ...(toolCalls.pop() ?? {
                      id: '',
                      name: '',
                      arguments: '',
                      loading: true,
                    }),
                  };
                  toolCall.arguments += data.contentBlockDelta.delta.toolUse.input;
                  toolCalls.push(toolCall);
                  responseMessage.toolCalls = toolCalls;
                }
                setMessages?.((prev) => [...prev.slice(0, -1), { ...responseMessage }]);
              } else if (data && data.messageStart) {
                // message start
              } else if (data && data.messageStop) {
                // message stop
              }
              // error
              else if (
                data &&
                (data.internalServerException ||
                  data.modelStreamErrorException ||
                  data.validationException ||
                  data.throttlingException ||
                  data.serviceUnavailableException)
              ) {
                responseMessage.content += '\n\nAn error occurred while processing the response.';
                responseMessage.toolCalls = [];
                setMessages?.((prev) => [...prev.slice(0, -1), { ...responseMessage }]);
                console.error('Error in AI prompt handling:', data.error);
                return { error: true, content: 'An error occurred while processing the response.', toolCalls: [] };
              }
            } catch (error) {
              console.error('Error in AI prompt handling:', error);
              // Not JSON or unexpected format, skip
            }
          }
        }
      }

      if (!responseMessage.content) {
        responseMessage.content =
          responseMessage.toolCalls.length > 0 ? '' : "I'm sorry, I don't have a response for that.";
        setMessages?.((prev) => [...prev.slice(0, -1), { ...responseMessage }]);
      }

      return { content: responseMessage.content, toolCalls: responseMessage.toolCalls };
    },
    []
  );

  const parseAnthropicStream = useCallback(
    async (
      reader: ReadableStreamDefaultReader<Uint8Array>,
      responseMessage: AIMessagePrompt,
      setMessages?: (value: React.SetStateAction<ChatMessage[]>) => void
    ): Promise<{ error?: boolean; content: AIMessagePrompt['content']; toolCalls: AIMessagePrompt['toolCalls'] }> => {
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
                  const toolCalls = [...responseMessage.toolCalls];
                  const toolCall = {
                    id: data.content_block.id,
                    name: data.content_block.name,
                    arguments: '',
                    loading: true,
                  };
                  toolCalls.push(toolCall);
                  responseMessage.toolCalls = toolCalls;
                }
                setMessages?.((prev) => [...prev.slice(0, -1), { ...responseMessage }]);
              } else if (data.type === 'content_block_delta') {
                if (data.delta.type === 'text_delta') {
                  responseMessage.content += data.delta.text;
                } else if (data.delta.type === 'input_json_delta') {
                  const toolCalls = [...responseMessage.toolCalls];
                  const toolCall = {
                    ...(toolCalls.pop() ?? {
                      id: '',
                      name: '',
                      arguments: '',
                      loading: true,
                    }),
                  };
                  toolCall.arguments += data.delta.partial_json;
                  toolCalls.push(toolCall);
                  responseMessage.toolCalls = toolCalls;
                }
                setMessages?.((prev) => [...prev.slice(0, -1), { ...responseMessage }]);
              } else if (data.type === 'content_block_stop') {
                const toolCalls = [...responseMessage.toolCalls];
                let toolCall = toolCalls.pop();
                if (toolCall) {
                  toolCall = { ...toolCall, loading: false };
                  toolCalls.push(toolCall);
                  responseMessage.toolCalls = toolCalls;
                  setMessages?.((prev) => [...prev.slice(0, -1), { ...responseMessage }]);
                }
              } else if (data.type === 'message_start') {
                // message start
              } else if (data.type === 'message_stop') {
                // message stop
              } else if (data.type === 'error') {
                responseMessage.content += '\n\nAn error occurred while processing the response.';
                responseMessage.toolCalls = [];
                setMessages?.((prev) => [...prev.slice(0, -1), { ...responseMessage }]);
                console.error('Error in AI prompt handling:', data.error);
                return { error: true, content: 'An error occurred while processing the response.', toolCalls: [] };
              }
            } catch (error) {
              console.error('Error in AI prompt handling:', error);
              // Not JSON or unexpected format, skip
            }
          }
        }
      }

      if (!responseMessage.content) {
        responseMessage.content =
          responseMessage.toolCalls.length > 0 ? '' : "I'm sorry, I don't have a response for that.";
        setMessages?.((prev) => [...prev.slice(0, -1), { ...responseMessage }]);
      }

      return { content: responseMessage.content, toolCalls: responseMessage.toolCalls };
    },
    []
  );

  const parseOpenAIStream = useCallback(
    async (
      reader: ReadableStreamDefaultReader<Uint8Array>,
      responseMessage: AIMessagePrompt,
      setMessages?: (value: React.SetStateAction<ChatMessage[]>) => void
    ): Promise<{ error?: boolean; content: AIMessagePrompt['content']; toolCalls: AIMessagePrompt['toolCalls'] }> => {
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
                // text delta
                if (data.choices[0].delta.content) {
                  responseMessage.content += data.choices[0].delta.content;
                  setMessages?.((prev) => [...prev.slice(0, -1), { ...responseMessage }]);
                }
                // tool use delta
                else if (data.choices[0].delta.tool_calls) {
                  data.choices[0].delta.tool_calls.forEach(
                    (tool_call: { id: string; function: { name?: string; arguments: string } }) => {
                      const toolCalls = [...responseMessage.toolCalls];
                      let toolCall = toolCalls.pop();
                      if (toolCall) {
                        toolCall = {
                          ...toolCall,
                          loading: true,
                        };
                        toolCalls.push(toolCall);
                      }
                      if (tool_call.function.name) {
                        toolCall = {
                          id: tool_call.id,
                          name: tool_call.function.name,
                          arguments: tool_call.function.arguments,
                          loading: true,
                        };
                        toolCalls.push(toolCall);
                      } else {
                        const toolCall = {
                          ...(toolCalls.pop() ?? {
                            id: '',
                            name: '',
                            arguments: '',
                            loading: true,
                          }),
                        };
                        toolCall.arguments += tool_call?.function?.arguments ?? '';
                        toolCalls.push(toolCall);
                      }
                      responseMessage.toolCalls = toolCalls;
                    }
                  );
                  setMessages?.((prev) => [...prev.slice(0, -1), { ...responseMessage }]);
                }
                // tool use stop
                else if (data.choices[0].finish_reason === 'tool_calls') {
                  responseMessage.toolCalls = responseMessage.toolCalls.map((toolCall) => ({
                    ...toolCall,
                    loading: false,
                  }));
                  setMessages?.((prev) => [...prev.slice(0, -1), { ...responseMessage }]);
                } else if (data.choices[0].delta.refusal) {
                  console.warn('Invalid AI response: ', data.choices[0].delta.refusal);
                }
              } else if (data.error) {
                responseMessage.content += '\n\nAn error occurred while processing the response.';
                responseMessage.toolCalls = [];
                setMessages?.((prev) => [...prev.slice(0, -1), { ...responseMessage }]);
                console.error('Error in AI prompt handling:', data.error);
                return { error: true, content: 'An error occurred while processing the response.', toolCalls: [] };
              }
            } catch (error) {
              console.error('Error in AI prompt handling:', error);
              // Not JSON or unexpected format, skip
            }
          }
        }
      }

      if (!responseMessage.content) {
        responseMessage.content =
          responseMessage.toolCalls.length > 0 ? '' : "I'm sorry, I don't have a response for that.";
        setMessages?.((prev) => [...prev.slice(0, -1), { ...responseMessage }]);
      }

      return { content: responseMessage.content, toolCalls: responseMessage.toolCalls };
    },
    []
  );

  const handleAIRequestToAPI = useCallback(
    async ({
      model,
      system,
      messages,
      setMessages,
      signal,
      useStream,
      useTools,
      toolChoice,
    }: HandleAIPromptProps): Promise<{
      error?: boolean;
      content: AIMessagePrompt['content'];
      toolCalls: AIMessagePrompt['toolCalls'];
    }> => {
      const responseMessage: AIMessagePrompt = {
        role: 'assistant',
        content: '',
        contextType: 'userPrompt',
        toolCalls: [],
      };
      setMessages?.((prev) => [...prev, { ...responseMessage, content: '' }]);

      try {
        const token = await authClient.getTokenOrRedirect();
        const { temperature, max_tokens, canStream, canStreamWithToolCalls } = MODEL_OPTIONS[model];
        const stream = canStream
          ? useTools
            ? canStreamWithToolCalls && (useStream ?? canStream)
            : useStream ?? canStream
          : false;
        const tools = !useTools ? undefined : getTools(model, toolChoice);
        const tool_choice = !useTools ? undefined : getToolChoice(model, toolChoice);
        const endpoint = getAIProviderEndpoint(model, stream);
        const response = await fetch(endpoint, {
          method: 'POST',
          signal,
          headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ model, system, messages, temperature, max_tokens, tools, tool_choice }),
        });

        if (!response.ok) {
          const error =
            response.status === 429
              ? 'You have exceeded the maximum number of requests. Please try again later.'
              : `Looks like there was a problem. Status Code: ${response.status}`;
          setMessages?.((prev) => [
            ...prev.slice(0, -1),
            { role: 'assistant', content: error, contextType: 'userPrompt', model, toolCalls: [] },
          ]);
          if (response.status !== 429) {
            console.error(`Error retrieving data from AI API: ${response.status}`);
          }
          return { error: true, content: error, toolCalls: [] };
        }

        const isBedrock = isBedrockModel(model);
        const isBedrockAnthropic = isAnthropicBedrockModel(model);
        const isAnthropic = isAnthropicModel(model);
        const isOpenAI = isOpenAIModel(model);

        // handle streaming response
        if (stream) {
          const reader = response.body?.getReader();
          if (!reader) throw new Error('Response body is not readable');

          // handle streaming Bedrock response
          if (isBedrock) {
            return parseBedrockStream(reader, responseMessage, setMessages);
          }

          // handle streaming Anthropic response
          else if (isAnthropic || isBedrockAnthropic) {
            return parseAnthropicStream(reader, responseMessage, setMessages);
          }

          // handle streaming OpenAI response
          else if (isOpenAI) {
            return parseOpenAIStream(reader, responseMessage, setMessages);
          }

          // should never happen
          else {
            throw new Error(`Unknown model: ${model}`);
          }
        }

        // handle non-streaming response
        else {
          const data = await response.json();
          // handle non-streaming Bedrock response
          if (isBedrock) {
            if (
              !data ||
              !data.message ||
              data.message.role !== 'assistant' ||
              !data.message.content ||
              !data.message.content.length
            ) {
              throw new Error('No data returned from AI API');
            }
            data.message.content.forEach(
              (contentBlock: { text: string } | { toolUse: { toolUseId: string; name: string; input: unknown } }) => {
                if ('text' in contentBlock) {
                  responseMessage.content += contentBlock.text;
                  setMessages?.((prev) => [...prev.slice(0, -1), { ...responseMessage }]);
                } else if ('toolUse' in contentBlock) {
                  responseMessage.toolCalls = [
                    ...responseMessage.toolCalls,
                    {
                      id: contentBlock.toolUse.toolUseId,
                      name: contentBlock.toolUse.name,
                      arguments: JSON.stringify(contentBlock.toolUse.input),
                      loading: false,
                    },
                  ];
                  setMessages?.((prev) => [...prev.slice(0, -1), { ...responseMessage }]);
                } else {
                  console.error(`Invalid AI response: ${JSON.stringify(contentBlock)}`);
                }
              }
            );
          }
          // handle non-streaming Anthropic response
          else if (isAnthropic || isBedrockAnthropic) {
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
                    responseMessage.toolCalls = [
                      ...responseMessage.toolCalls,
                      {
                        id: message.id,
                        name: message.name,
                        arguments: JSON.stringify(message.input),
                        loading: false,
                      },
                    ];
                    setMessages?.((prev) => [...prev.slice(0, -1), { ...responseMessage }]);
                    break;
                  default:
                    console.error(`Invalid AI response: ${JSON.stringify(message)}`);
                }
              }
            );
          }
          // handle non-streaming OpenAI response
          else if (isOpenAI) {
            if (data) {
              if (data.content) {
                responseMessage.content += data.content;
                setMessages?.((prev) => [...prev.slice(0, -1), { ...responseMessage }]);
              } else if (data.tool_calls) {
                data.tool_calls.forEach(
                  (toolCall: { type: string; id: string; function: { name: string; arguments: string } }) => {
                    switch (toolCall.type) {
                      case 'function':
                        responseMessage.toolCalls = [
                          ...responseMessage.toolCalls,
                          {
                            id: toolCall.id,
                            name: toolCall.function.name,
                            arguments: toolCall.function.arguments,
                            loading: false,
                          },
                        ];
                        setMessages?.((prev) => [...prev.slice(0, -1), { ...responseMessage }]);
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
          // should never happen
          else {
            throw new Error(`Unknown model: ${model}`);
          }

          if (!responseMessage.content) {
            responseMessage.content =
              responseMessage.toolCalls.length > 0 ? '' : "I'm sorry, I don't have a response for that.";
            setMessages?.((prev) => [...prev.slice(0, -1), { ...responseMessage }]);
          }

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
    [parseBedrockStream, parseAnthropicStream, parseOpenAIStream]
  );

  return { handleAIRequestToAPI };
}
