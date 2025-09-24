import type { Response } from 'express';
import type OpenAI from 'openai';
import type { ChatCompletionCreateParamsNonStreaming, ChatCompletionCreateParamsStreaming } from 'openai/resources';
import { getModelFromModelKey, getModelOptions } from 'quadratic-shared/ai/helpers/model.helper';
import type {
  AIRequestHelperArgs,
  AzureOpenAIModelKey,
  BasetenModelKey,
  FireworksModelKey,
  OpenRouterModelKey,
  ParsedAIResponse,
  XAIModelKey,
} from 'quadratic-shared/typesAndSchemasAI';
import {
  getOpenAIChatCompletionsApiArgs,
  parseOpenAIChatCompletionsResponse,
  parseOpenAIChatCompletionsStream,
} from '../helpers/openai.chatCompletions.helper';

export const handleOpenAIChatCompletionsRequest = async (
  modelKey: AzureOpenAIModelKey | XAIModelKey | BasetenModelKey | FireworksModelKey | OpenRouterModelKey,
  args: AIRequestHelperArgs,
  isOnPaidPlan: boolean,
  exceededBillingLimit: boolean,
  openai: OpenAI,
  response?: Response,
  signal?: AbortSignal
): Promise<ParsedAIResponse | undefined> => {
  const model = getModelFromModelKey(modelKey);
  const options = getModelOptions(modelKey, args);
  const { messages, tools, tool_choice } = getOpenAIChatCompletionsApiArgs(
    args,
    options.aiModelMode,
    options.strictParams,
    options.imageSupport
  );

  let apiArgs: ChatCompletionCreateParamsStreaming | ChatCompletionCreateParamsNonStreaming = {
    model,
    messages,
    temperature: options.temperature,
    max_completion_tokens: !options.max_tokens ? undefined : options.max_tokens,
    stream: options.stream,
    tools,
    tool_choice,
    ...(options.top_p !== undefined ? { top_p: options.top_p } : {}),
    ...(options.top_k !== undefined ? { top_k: options.top_k } : {}),
    ...(options.min_p !== undefined ? { min_p: options.min_p } : {}),
    ...(options.repetition_penalty !== undefined ? { repetition_penalty: options.repetition_penalty } : {}),
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
    const completion = await openai.chat.completions.create(apiArgs as ChatCompletionCreateParamsStreaming, { signal });
    const parsedResponse = await parseOpenAIChatCompletionsStream(
      completion,
      modelKey,
      isOnPaidPlan,
      exceededBillingLimit,
      response
    );
    return parsedResponse;
  } else {
    const result = await openai.chat.completions.create(apiArgs as ChatCompletionCreateParamsNonStreaming, { signal });
    const parsedResponse = parseOpenAIChatCompletionsResponse(
      result,
      modelKey,
      isOnPaidPlan,
      exceededBillingLimit,
      response
    );
    return parsedResponse;
  }
};
