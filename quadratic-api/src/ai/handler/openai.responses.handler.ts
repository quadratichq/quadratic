import type OpenAI from 'openai';
import type {
  ResponseCreateParamsNonStreaming,
  ResponseCreateParamsStreaming,
} from 'openai/resources/responses/responses';
import { getModelFromModelKey, getModelOptions } from 'quadratic-shared/ai/helpers/model.helper';
import type { AzureOpenAIModelKey, OpenAIModelKey, ParsedAIResponse } from 'quadratic-shared/typesAndSchemasAI';
import {
  getOpenAIResponsesApiArgs,
  parseOpenAIResponsesResponse,
  parseOpenAIResponsesStream,
} from '../helpers/openai.responses.helper';
import type { HandleAIRequestArgs } from './ai.handler';

interface HandleOpenAIResponsesRequestArgs extends Omit<HandleAIRequestArgs, 'modelKey'> {
  modelKey: OpenAIModelKey | AzureOpenAIModelKey;
  openai: OpenAI;
}
export const handleOpenAIResponsesRequest = async ({
  modelKey,
  args,
  isOnPaidPlan,
  exceededBillingLimit,
  response,
  signal,
  openai,
}: HandleOpenAIResponsesRequestArgs): Promise<ParsedAIResponse | undefined> => {
  const model = getModelFromModelKey(modelKey);
  const options = getModelOptions(modelKey, args);

  const { messages, tools, tool_choice } = getOpenAIResponsesApiArgs(
    args,
    options.aiModelMode,
    options.strictParams,
    options.imageSupport
  );

  const apiArgs: ResponseCreateParamsStreaming | ResponseCreateParamsNonStreaming = {
    model,
    input: messages,
    temperature: options.temperature,
    max_output_tokens: !options.max_tokens ? undefined : options.max_tokens,
    stream: options.stream,
    tools,
    tool_choice,
    parallel_tool_calls: false,
    ...(options.supportsReasoning
      ? {
          reasoning: {
            effort: options.reasoningEffort ?? 'medium',
            summary: 'auto',
          },
        }
      : {}),
    service_tier: options.serviceTier,
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

    const responses = await openai.responses.create(apiArgs as ResponseCreateParamsStreaming, { signal });
    const parsedResponse = await parseOpenAIResponsesStream(
      responses,
      modelKey,
      isOnPaidPlan,
      exceededBillingLimit,
      response
    );
    return parsedResponse;
  } else {
    const responses = await openai.responses.create(apiArgs as ResponseCreateParamsNonStreaming, { signal });
    const parsedResponse = parseOpenAIResponsesResponse(
      responses,
      modelKey,
      isOnPaidPlan,
      exceededBillingLimit,
      response
    );
    return parsedResponse;
  }
};
