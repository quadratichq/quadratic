import type { BedrockRuntimeClient } from '@aws-sdk/client-bedrock-runtime';
import { ConverseCommand, ConverseStreamCommand } from '@aws-sdk/client-bedrock-runtime';
import { type Response } from 'express';
import { getModelOptions } from 'quadratic-shared/ai/helpers/model.helper';
import type { AIMessagePrompt, AIRequestBody, BedrockModel } from 'quadratic-shared/typesAndSchemasAI';
import { getBedrockApiArgs, parseBedrockResponse, parseBedrockStream } from '../helpers/bedrock.helper';

export const handleBedrockRequest = async (
  model: BedrockModel,
  args: Omit<AIRequestBody, 'chatId' | 'fileUuid' | 'source' | 'model'>,
  response: Response,
  bedrock: BedrockRuntimeClient
): Promise<AIMessagePrompt | undefined> => {
  const { system, messages, tools, tool_choice } = getBedrockApiArgs(args);
  const { stream, temperature, max_tokens } = getModelOptions(model, args);

  if (stream) {
    try {
      const command = new ConverseStreamCommand({
        modelId: model,
        system,
        messages,
        inferenceConfig: { maxTokens: max_tokens, temperature },
        toolConfig: tools &&
          tool_choice && {
            tools,
            toolChoice: tool_choice,
          },
      });

      const chunks = (await bedrock.send(command)).stream ?? [];

      response.setHeader('Content-Type', 'text/event-stream');
      response.setHeader('Cache-Control', 'no-cache');
      response.setHeader('Connection', 'keep-alive');

      const responseMessage = await parseBedrockStream(chunks, response, model);
      return responseMessage;
    } catch (error: any) {
      if (!response.headersSent) {
        if (error.response) {
          response.status(error.response.status).json(error.response.data);
          console.log(error.response.status, error.response.data);
        } else {
          response.status(400).json(error.message);
          console.log(error.message);
        }
      } else {
        console.error('Error occurred after headers were sent:', error);
      }
    }
  } else {
    try {
      const command = new ConverseCommand({
        modelId: model,
        system,
        messages,
        inferenceConfig: { maxTokens: max_tokens, temperature },
        toolConfig: tools &&
          tool_choice && {
            tools,
            toolChoice: tool_choice,
          },
      });

      const result = await bedrock.send(command);
      const responseMessage = parseBedrockResponse(result.output, response, model);
      return responseMessage;
    } catch (error: any) {
      if (error.response) {
        response.status(error.response.status).json(error.response.data);
        console.log(error.response.status, error.response.data);
      } else {
        response.status(400).json(error.message);
        console.log(error.message);
      }
    }
  }
};
