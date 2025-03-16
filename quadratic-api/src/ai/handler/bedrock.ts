import type { BedrockRuntimeClient, ConverseRequest, ConverseStreamRequest } from '@aws-sdk/client-bedrock-runtime';
import { ConverseCommand, ConverseStreamCommand } from '@aws-sdk/client-bedrock-runtime';
import type { Response } from 'express';
import { getModelFromModelKey, getModelOptions } from 'quadratic-shared/ai/helpers/model.helper';
import type { AIRequestHelperArgs, BedrockModelKey, ParsedAIResponse } from 'quadratic-shared/typesAndSchemasAI';
import { getBedrockApiArgs, parseBedrockResponse, parseBedrockStream } from '../helpers/bedrock.helper';

export const handleBedrockRequest = async (
  modelKey: BedrockModelKey,
  args: AIRequestHelperArgs,
  response: Response,
  bedrock: BedrockRuntimeClient
): Promise<ParsedAIResponse | undefined> => {
  const model = getModelFromModelKey(modelKey);
  const options = getModelOptions(modelKey, args);
  const { system, messages, tools, tool_choice } = getBedrockApiArgs(args);

  try {
    const requestArgs: ConverseStreamRequest | ConverseRequest = {
      modelId: model,
      system,
      messages,
      inferenceConfig: { maxTokens: options.max_tokens, temperature: options.temperature },
      toolConfig: tools &&
        tool_choice && {
          tools,
          toolChoice: tool_choice,
        },
    };

    if (options.stream) {
      const command = new ConverseStreamCommand(requestArgs);

      const chunks = (await bedrock.send(command)).stream ?? [];

      response.setHeader('Content-Type', 'text/event-stream');
      response.setHeader('Cache-Control', 'no-cache');
      response.setHeader('Connection', 'keep-alive');

      const parsedResponse = await parseBedrockStream(chunks, response, modelKey);
      return parsedResponse;
    } else {
      const command = new ConverseCommand(requestArgs);

      const result = await bedrock.send(command);
      const parsedResponse = parseBedrockResponse(result, response, modelKey);
      return parsedResponse;
    }
  } catch (error: any) {
    if (!options.stream || !response.headersSent) {
      if (error.response) {
        response.status(error.response.status).json({ error: error.response.data });
        console.log(error.response.status, error.response.data);
      } else {
        response.status(400).json({ error: error.message });
        console.log(error.message);
      }
    } else {
      response.end();
      console.log('Error occurred after headers were sent:', error);
    }
  }
};
