import Anthropic from '@anthropic-ai/sdk';
import express from 'express';
import rateLimit from 'express-rate-limit';
import { AnthropicAutoCompleteRequestBodySchema } from 'quadratic-shared/typesAndSchemasAI';
import { ANTHROPIC_API_KEY, RATE_LIMIT_AI_REQUESTS_MAX, RATE_LIMIT_AI_WINDOW_MS } from '../../env-vars';
import { validateAccessToken } from '../../middleware/validateAccessToken';
import { Request } from '../../types/Request';

const anthropic_router = express.Router();

const anthropic = new Anthropic({
  apiKey: ANTHROPIC_API_KEY,
});

const ai_rate_limiter = rateLimit({
  windowMs: Number(RATE_LIMIT_AI_WINDOW_MS) || 3 * 60 * 60 * 1000, // 3 hours
  max: Number(RATE_LIMIT_AI_REQUESTS_MAX) || 25, // Limit number of requests per windowMs
  standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
  legacyHeaders: false, // Disable the `X-RateLimit-*` headers
  keyGenerator: (request: Request) => {
    return request.auth?.sub || 'anonymous';
  },
});

anthropic_router.post('/anthropic/chat', validateAccessToken, ai_rate_limiter, async (request, response) => {
  try {
    const { model, messages } = AnthropicAutoCompleteRequestBodySchema.parse(request.body);
    const message = await anthropic.messages.create({
      model,
      messages,
      temperature: 0,
      max_tokens: 8192,
    });
    response.json(message);
  } catch (error: any) {
    if (error.response) {
      response.status(error.response.status).json(error.response.data);
    } else {
      response.status(400).json(error.message);
    }
  }
});

anthropic_router.post(
  '/anthropic/chat/stream',
  validateAccessToken,
  ai_rate_limiter,
  async (request: Request, response) => {
    try {
      const { model, messages } = AnthropicAutoCompleteRequestBodySchema.parse(request.body);

      response.setHeader('Content-Type', 'text/event-stream');
      response.setHeader('Cache-Control', 'no-cache');
      response.setHeader('Connection', 'keep-alive');

      const chunks = await anthropic.messages.create({
        model,
        messages,
        max_tokens: 8192,
        stream: true,
      });

      for await (const chunk of chunks) {
        response.write(`data: ${JSON.stringify(chunk)}\n\n`);
      }

      response.end();
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
);

export default anthropic_router;
