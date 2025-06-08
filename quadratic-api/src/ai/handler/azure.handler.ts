import type { Response } from 'express';
import OpenAI from 'openai';
import type { ChatCompletionCreateParamsNonStreaming, ChatCompletionCreateParamsStreaming } from 'openai/resources';
import { getModelFromModelKey, getModelOptions, isAzureFoundryModel } from 'quadratic-shared/ai/helpers/model.helper';
import type {
  AIRequestHelperArgs,
  AzureFoundryModelKey,
  AzureOpenAIModelKey,
  ParsedAIResponse,
} from 'quadratic-shared/typesAndSchemasAI';
import { getOpenAIApiArgs, parseOpenAIResponse, parseOpenAIStream } from '../helpers/openai.helper';

export const handleAzureRequest = async (
  modelKey: AzureOpenAIModelKey | AzureFoundryModelKey,
  args: AIRequestHelperArgs,
  openai: OpenAI,
  response?: Response
): Promise<ParsedAIResponse | undefined> => {
  const model = getModelFromModelKey(modelKey);
  const options = getModelOptions(modelKey, args);
  const { messages, tools, tool_choice } = getOpenAIApiArgs(args, options.strictParams);
  const isFoundry = isAzureFoundryModel(modelKey);
  const path = isFoundry ? undefined : `/openai/deployments/${model}/chat/completions`;
  const requestOptions = path ? { path } : undefined;

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
      const completion = await openai.chat.completions.create(
        apiArgs as ChatCompletionCreateParamsStreaming,
        requestOptions
      );

      const parsedResponse = await parseOpenAIStream(completion, modelKey, response);
      return parsedResponse;
    } else {
      const result = await openai.chat.completions.create(
        apiArgs as ChatCompletionCreateParamsNonStreaming,
        requestOptions
      );

      const parsedResponse = parseOpenAIResponse(result, modelKey, response);
      return parsedResponse;
    }
  } catch (error: any) {
    if (error instanceof OpenAI.APIError) {
      console.error('[API] Error', error.status, error.name, error.message);
      response?.status(error.status || 500).json({ error: error.message });
      return;
    }
    if (error.request && error.request.aborted) {
      // request was aborted, so we don't need to do anything
      return;
    }
    response?.status(500).json({ error: 'Error processing request.' });
  }
};
