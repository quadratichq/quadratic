import express from 'express';
import rateLimit from 'express-rate-limit';
import OpenAI from 'openai';
import { OpenAIAutoCompleteRequestBodySchema } from 'quadratic-shared/typesAndSchemasAI';
import { OPENAI_API_KEY, RATE_LIMIT_AI_REQUESTS_MAX, RATE_LIMIT_AI_WINDOW_MS } from '../../env-vars';
import { validateAccessToken } from '../../middleware/validateAccessToken';
import { Request } from '../../types/Request';

const openai_router = express.Router();

const openai = new OpenAI({
  apiKey: OPENAI_API_KEY || '',
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

openai_router.post('/openai/chat', validateAccessToken, ai_rate_limiter, async (request, response) => {
  try {
    const { model, messages, temperature } = OpenAIAutoCompleteRequestBodySchema.parse(request.body);
    const result = await openai.chat.completions.create({
      model,
      messages,
      temperature,
    });
    response.json(result.choices[0].message);
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

openai_router.post('/openai/chat/stream', validateAccessToken, ai_rate_limiter, async (request: Request, response) => {
  try {
    const { model, messages, temperature } = OpenAIAutoCompleteRequestBodySchema.parse(request.body);
    const completion = await openai.chat.completions.create({
      model,
      messages,
      temperature,
      stream: true,
    });

    response.setHeader('Content-Type', 'text/event-stream');
    response.setHeader('Cache-Control', 'no-cache');
    response.setHeader('Connection', 'keep-alive');
    for await (const chunk of completion) {
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
});

export default openai_router;
