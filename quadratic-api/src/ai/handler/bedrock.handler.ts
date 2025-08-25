import type { BedrockRuntimeClient, ConverseRequest, ConverseStreamRequest } from '@aws-sdk/client-bedrock-runtime';
import { ConverseCommand, ConverseStreamCommand } from '@aws-sdk/client-bedrock-runtime';
import type { Response } from 'express';
import { getModelFromModelKey, getModelOptions } from 'quadratic-shared/ai/helpers/model.helper';
import type { AIRequestHelperArgs, BedrockModelKey, ParsedAIResponse } from 'quadratic-shared/typesAndSchemasAI';
import { getBedrockApiArgs, parseBedrockResponse, parseBedrockStream } from '../helpers/bedrock.helper';

export const handleBedrockRequest = async (
  modelKey: BedrockModelKey,
  args: AIRequestHelperArgs,
  isOnPaidPlan: boolean,
  exceededBillingLimit: boolean,
  bedrock: BedrockRuntimeClient,
  response?: Response
): Promise<ParsedAIResponse | undefined> => {
  const model = getModelFromModelKey(modelKey);
  const options = getModelOptions(modelKey, args);
  const { system, messages, tools, tool_choice } = getBedrockApiArgs(args, options.aiModelMode);

  const apiArgs: ConverseStreamRequest | ConverseRequest = {
    modelId: model,
    system,
    messages,
    inferenceConfig: {
      maxTokens: !options.max_tokens ? undefined : options.max_tokens,
      temperature: options.temperature,
    },
    toolConfig: tools &&
      tool_choice && {
        tools,
        toolChoice: tool_choice,
      },
  };

  if (options.stream) {
    if (!response?.headersSent) {
      response?.setHeader('Content-Type', 'text/event-stream');
      response?.setHeader('Cache-Control', 'no-cache');
      response?.setHeader('Connection', 'keep-alive');
    }
    response?.write(`stream\n\n`);

    const command = new ConverseStreamCommand(apiArgs);
    const chunks = (await bedrock.send(command)).stream ?? [];
    const parsedResponse = await parseBedrockStream(chunks, modelKey, isOnPaidPlan, exceededBillingLimit, response);
    return parsedResponse;
  } else {
    const command = new ConverseCommand(apiArgs);
    const result = await bedrock.send(command);
    const parsedResponse = parseBedrockResponse(result, modelKey, isOnPaidPlan, exceededBillingLimit, response);
    return parsedResponse;
  }
};
