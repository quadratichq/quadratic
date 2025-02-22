import type AnthropicBedrock from '@anthropic-ai/bedrock-sdk';
import Anthropic from '@anthropic-ai/sdk';
import type { Response } from 'express';
import { getModelOptions } from 'quadratic-shared/ai/helpers/model.helper';
import type {
  AIMessagePrompt,
  AIRequestHelperArgs,
  AnthropicModel,
  BedrockAnthropicModel,
} from 'quadratic-shared/typesAndSchemasAI';
import { getAnthropicApiArgs, parseAnthropicResponse, parseAnthropicStream } from '../helpers/anthropic.helper';

export const handleAnthropicRequest = async (
  model: BedrockAnthropicModel | AnthropicModel,
  args: AIRequestHelperArgs,
  response: Response,
  anthropic: AnthropicBedrock | Anthropic
): Promise<AIMessagePrompt | undefined> => {
  const { system, messages, tools, tool_choice } = getAnthropicApiArgs(args);
  const { stream, temperature, max_tokens } = getModelOptions(model, args);

  if (stream) {
    try {
      const chunks = await anthropic.messages.create({
        model,
        system,
        messages,
        temperature,
        max_tokens,
        stream: true,
        tools,
        tool_choice,
      });

      response.setHeader('Content-Type', 'text/event-stream');
      response.setHeader('Cache-Control', 'no-cache');
      response.setHeader('Connection', 'keep-alive');

      const responseMessage = await parseAnthropicStream(chunks, response, model);
      return responseMessage;
    } catch (error: any) {
      if (!response.headersSent) {
        if (error instanceof Anthropic.APIError) {
          response.status(error.status ?? 400).json(error.message);
          console.log(error.status, error.message);
        } else {
          response.status(400).json(error);
          console.log(error);
        }
      } else {
        console.error('Error occurred after headers were sent:', error);
      }
    }
  } else {
    try {
      const result = await anthropic.messages.create({
        model,
        system,
        messages,
        temperature,
        max_tokens,
        tools,
        tool_choice,
      });
      const responseMessage = parseAnthropicResponse(result, response, model);
      return responseMessage;
    } catch (error: any) {
      if (error instanceof Anthropic.APIError) {
        response.status(error.status ?? 400).json(error.message);
        console.log(error.status, error.message);
      } else {
        response.status(400).json(error);
        console.log(error);
      }
    }
  }
};
