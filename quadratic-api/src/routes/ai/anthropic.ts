import Anthropic from '@anthropic-ai/sdk';
import { type Response } from 'express';
import { getAnthropicApiArgs } from 'quadratic-shared/ai/helpers/anthropic.helper';
import { getModelOptions } from 'quadratic-shared/ai/helpers/model.helper';
import type { AIAutoCompleteRequestBody, AnthropicModel } from 'quadratic-shared/typesAndSchemasAI';
import { ANTHROPIC_API_KEY } from '../../env-vars';

const anthropic = new Anthropic({
  apiKey: ANTHROPIC_API_KEY,
});

export const handleAnthropicRequest = async (
  model: AnthropicModel,
  args: Omit<AIAutoCompleteRequestBody, 'model'>,
  response: Response
) => {
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
      for await (const chunk of chunks) {
        if (!response.writableEnded) {
          response.write(`data: ${JSON.stringify(chunk)}\n\n`);
        } else {
          break;
        }
      }

      if (!response.writableEnded) {
        response.end();
      }
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

      response.json(result.content);
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
