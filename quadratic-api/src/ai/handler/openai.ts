import type { Response } from 'express';
import OpenAI from 'openai';
import type { ChatCompletionCreateParamsNonStreaming, ChatCompletionCreateParamsStreaming } from 'openai/resources';
import { getModelFromModelKey, getModelOptions } from 'quadratic-shared/ai/helpers/model.helper';
import type {
  AIRequestHelperArgs,
  OpenAIModelKey,
  ParsedAIResponse,
  XAIModelKey,
} from 'quadratic-shared/typesAndSchemasAI';
import { getOpenAIApiArgs, parseOpenAIResponse, parseOpenAIStream } from '../helpers/openai.helper';

export const handleOpenAIRequest = async (
  modelKey: OpenAIModelKey | XAIModelKey,
  args: AIRequestHelperArgs,
  response: Response,
  openai: OpenAI
): Promise<ParsedAIResponse | undefined> => {
  const model = getModelFromModelKey(modelKey);
  const options = getModelOptions(modelKey, args);
  const { messages, tools, tool_choice } = getOpenAIApiArgs(args, options.strictParams);

  try {
    let apiArgs: ChatCompletionCreateParamsStreaming | ChatCompletionCreateParamsNonStreaming = {
      model,
      messages,
      temperature: options.temperature,
      stream: options.stream,
      tools,
      tool_choice,
    };
    if (options.stream) {
      apiArgs = {
        ...apiArgs,
        stream_options: {
          include_usage: true,
        },
      };
      const completion = await openai.chat.completions.create(apiArgs as ChatCompletionCreateParamsStreaming);

      response.setHeader('Content-Type', 'text/event-stream');
      response.setHeader('Cache-Control', 'no-cache');
      response.setHeader('Connection', 'keep-alive');

      const parsedResponse = await parseOpenAIStream(completion, response, modelKey);
      return parsedResponse;
    } else {
      const result = await openai.chat.completions.create(apiArgs as ChatCompletionCreateParamsNonStreaming);

      const parsedResponse = parseOpenAIResponse(result, response, modelKey);
      return parsedResponse;
    }
  } catch (error: any) {
    if (!options.stream || !response.headersSent) {
      if (error instanceof OpenAI.APIError) {
        response.status(error.status ?? 400).json({ error: error.message });
        console.log(error.status, error.message);
      } else {
        response.status(400).json({ error });
        console.log(error);
      }
    } else {
      response.end();
      console.log('Error occurred after headers were sent:', error);
    }
  }
};
