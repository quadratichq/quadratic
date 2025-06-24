import type { Response } from 'express';
import type OpenAI from 'openai';
import type { ChatCompletionCreateParamsNonStreaming, ChatCompletionCreateParamsStreaming } from 'openai/resources';
import { getModelFromModelKey, getModelOptions } from 'quadratic-shared/ai/helpers/model.helper';
import type {
  AIRequestHelperArgs,
  AzureModelKey,
  OpenAIModelKey,
  ParsedAIResponse,
  XAIModelKey,
} from 'quadratic-shared/typesAndSchemasAI';
import { getOpenAIApiArgs, parseOpenAIResponse, parseOpenAIStream } from '../helpers/openai.helper';

export const handleOpenAIRequest = async (
  modelKey: OpenAIModelKey | XAIModelKey | AzureModelKey,
  args: AIRequestHelperArgs,
  openai: OpenAI,
  response?: Response
): Promise<ParsedAIResponse | undefined> => {
  const model = getModelFromModelKey(modelKey);
  const options = getModelOptions(modelKey, args);
  const { messages, tools, tool_choice } = getOpenAIApiArgs(args, options.strictParams);

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
    if (!response?.headersSent) {
      response?.setHeader('Content-Type', 'text/event-stream');
      response?.setHeader('Cache-Control', 'no-cache');
      response?.setHeader('Connection', 'keep-alive');
    }
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
};
