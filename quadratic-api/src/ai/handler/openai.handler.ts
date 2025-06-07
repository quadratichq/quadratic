import type { Response } from 'express';
import OpenAI from 'openai';
import type { ChatCompletionCreateParamsNonStreaming, ChatCompletionCreateParamsStreaming } from 'openai/resources';
import { getModelFromModelKey, getModelOptions } from 'quadratic-shared/ai/helpers/model.helper';
import type {
  AIMessagePrompt,
  AIRequestHelperArgs,
  BasetenModelKey,
  OpenAIModelKey,
  ParsedAIResponse,
  XAIModelKey,
} from 'quadratic-shared/typesAndSchemasAI';
import { getOpenAIApiArgs, parseOpenAIResponse, parseOpenAIStream } from '../helpers/openai.helper';

export const handleOpenAIRequest = async (
  modelKey: OpenAIModelKey | XAIModelKey | BasetenModelKey,
  args: AIRequestHelperArgs,
  openai: OpenAI,
  response?: Response
): Promise<ParsedAIResponse | undefined> => {
  const model = getModelFromModelKey(modelKey);
  const options = getModelOptions(modelKey, args);
  const { messages, tools, tool_choice } = getOpenAIApiArgs(args, options.strictParams);

  try {
    let apiArgs: ChatCompletionCreateParamsStreaming | ChatCompletionCreateParamsNonStreaming = {
      model,
      messages,
      temperature: options.temperature,
      max_completion_tokens: options.max_tokens,
      stream: options.stream,
      tools,
      tool_choice,
    };
    if (options.stream) {
      response?.setHeader('Content-Type', 'text/event-stream');
      response?.setHeader('Cache-Control', 'no-cache');
      response?.setHeader('Connection', 'keep-alive');
      response?.write(`stream\n\n`);

      apiArgs = {
        ...apiArgs,
        stream_options: {
          include_usage: true,
        },
      };
      const completion = await openai.chat.completions.create(apiArgs as ChatCompletionCreateParamsStreaming);

      const parsedResponse = await parseOpenAIStream(completion, modelKey, response);
      return parsedResponse;
    } else {
      const result = await openai.chat.completions.create(apiArgs as ChatCompletionCreateParamsNonStreaming);

      const parsedResponse = parseOpenAIResponse(result, modelKey, response);
      return parsedResponse;
    }
  } catch (error: any) {
    if (!options.stream || !response?.headersSent) {
      if (error instanceof OpenAI.APIError) {
        response?.status(error.status ?? 400).json({ error: error.message });
        console.error(error.status, error.message);
      } else {
        response?.status(400).json({ error });
        console.error(error);
      }
    } else {
      const responseMessage: AIMessagePrompt = {
        role: 'assistant',
        content: [{ type: 'text', text: error instanceof OpenAI.APIError ? error.message : JSON.stringify(error) }],
        contextType: 'userPrompt',
        toolCalls: [],
        modelKey,
      };
      response?.write(`data: ${JSON.stringify(responseMessage)}\n\n`);
      response?.end();
      console.error('Error occurred after headers were sent:', error);
    }
  }
};
