import type { Response } from 'express';
import type OpenAI from 'openai';
import type {
  ResponseCreateParamsNonStreaming,
  ResponseCreateParamsStreaming,
} from 'openai/resources/responses/responses';
import { getModelFromModelKey, getModelOptions } from 'quadratic-shared/ai/helpers/model.helper';
import type { AIRequestHelperArgs, OpenAIModelKey, ParsedAIResponse } from 'quadratic-shared/typesAndSchemasAI';
import {
  getOpenAIResponsesApiArgs,
  parseOpenAIResponsesResponse,
  parseOpenAIResponsesStream,
} from '../helpers/openai.responses.helper';

export const handleOpenAIResponsesRequest = async (
  modelKey: OpenAIModelKey,
  args: AIRequestHelperArgs,
  isOnPaidPlan: boolean,
  exceededBillingLimit: boolean,
  openai: OpenAI,
  response?: Response
): Promise<ParsedAIResponse | undefined> => {
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
    ...(options.temperature !== undefined ? { temperature: options.temperature } : {}),
    max_output_tokens: !options.max_tokens ? undefined : options.max_tokens,
    stream: options.stream,
    tools,
    tool_choice,
    ...(options.supportsReasoning
      ? {
          reasoning: {
            effort: 'medium',
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

    const responses = await openai.responses.create(apiArgs as ResponseCreateParamsStreaming);
    const parsedResponse = await parseOpenAIResponsesStream(
      responses,
      modelKey,
      isOnPaidPlan,
      exceededBillingLimit,
      response
    );
    return parsedResponse;
  } else {
    const responses = await openai.responses.create(apiArgs as ResponseCreateParamsNonStreaming);
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
