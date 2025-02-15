import Anthropic from '@anthropic-ai/sdk';
import type { Response } from 'express';
import { getModelOptions } from 'quadratic-shared/ai/helpers/model.helper';
import type { AIRequestHelperArgs, AnthropicModel, ParsedAIResponse } from 'quadratic-shared/typesAndSchemasAI';
import { ANTHROPIC_API_KEY } from '../../env-vars';
import { getAnthropicApiArgs, parseAnthropicResponse, parseAnthropicStream } from '../helpers/anthropic.helper';

const anthropic = new Anthropic({
  apiKey: ANTHROPIC_API_KEY,
});

export const handleAnthropicRequest = async (
  model: AnthropicModel,
  args: AIRequestHelperArgs,
  response: Response
): Promise<ParsedAIResponse | undefined> => {
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

      const parsedResponse = await parseAnthropicStream(chunks, response, model);
      return parsedResponse;
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
        response.status(500).json('Error occurred after headers were sent');
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

      const parsedResponse = parseAnthropicResponse(result, response, model);
      return parsedResponse;
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
