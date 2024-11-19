import Anthropic from '@anthropic-ai/sdk';
import express from 'express';
import { MODEL_OPTIONS } from 'quadratic-shared/AI_MODELS';
import { AnthropicAutoCompleteRequestBodySchema } from 'quadratic-shared/typesAndSchemasAI';
import { ANTHROPIC_API_KEY } from '../../env-vars';
import { validateAccessToken } from '../../middleware/validateAccessToken';
import { Request } from '../../types/Request';
import { ai_rate_limiter } from './aiRateLimiter';

const anthropic_router = express.Router();

const anthropic = new Anthropic({
  apiKey: ANTHROPIC_API_KEY,
});

anthropic_router.post('/anthropic/chat', validateAccessToken, ai_rate_limiter, async (request, response) => {
  try {
    const { model, system, messages, tools, tool_choice } = AnthropicAutoCompleteRequestBodySchema.parse(request.body);
    const { temperature, max_tokens } = MODEL_OPTIONS[model];
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
    if (error.response) {
      response.status(error.response.status).json(error.response.data);
      console.log(error.response.status, error.response.data);
    } else {
      response.status(400).json(error.message);
      console.log(error.message);
    }
  }
});

anthropic_router.post(
  '/anthropic/chat/stream',
  validateAccessToken,
  ai_rate_limiter,
  async (request: Request, response) => {
    try {
      const { model, system, messages, tools, tool_choice } = AnthropicAutoCompleteRequestBodySchema.parse(
        request.body
      );
      const { temperature, max_tokens } = MODEL_OPTIONS[model];
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
  }
);

export default anthropic_router;
