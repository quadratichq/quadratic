import express from 'express';
import rateLimit from 'express-rate-limit';
import OpenAI from 'openai';
import { zodResponseFormat } from 'openai/helpers/zod';
import { AIAutoCompleteRequestBodySchema, SetValuesSchema } from 'quadratic-shared/typesAndSchemasAI';
import { OPENAI_API_KEY, RATE_LIMIT_AI_REQUESTS_MAX, RATE_LIMIT_AI_WINDOW_MS } from '../env-vars';
import { validateAccessToken } from '../middleware/validateAccessToken';
import { Request } from '../types/Request';

const ai_chat_router = express.Router();

const openai = new OpenAI({
  apiKey: OPENAI_API_KEY,
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

ai_chat_router.post('/chat', validateAccessToken, ai_rate_limiter, async (request, response) => {
  try {
    const json = AIAutoCompleteRequestBodySchema.parse(request.body);
    const result = await openai.chat.completions.create({
      model: json.model,
      messages: json.messages,
    });
    response.json(result.choices[0].message);
  } catch (error: any) {
    if (error.response) {
      response.status(error.response.status).json(error.response.data);
    } else {
      response.status(400).json(error.message);
    }
  }
});

ai_chat_router.post('/chat/stream', validateAccessToken, ai_rate_limiter, async (request: Request, response) => {
  try {
    const json = AIAutoCompleteRequestBodySchema.parse(request.body);

    response.setHeader('Content-Type', 'text/event-stream');
    response.setHeader('Cache-Control', 'no-cache');
    response.setHeader('Connection', 'keep-alive');

    const completion = await openai.chat.completions.create({
      model: json.model,
      messages: json.messages,
      stream: true,
    });

    for await (const chunk of completion) {
      response.write(`data: ${JSON.stringify(chunk)}\n\n`);
    }

    response.write('data: [DONE]\n\n');
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

ai_chat_router.post('/chat/assist', validateAccessToken, ai_rate_limiter, async (request, response) => {
  try {
    const json = AIAutoCompleteRequestBodySchema.parse(request.body);
    const result = await openai.chat.completions.create({
      model: json.model,
      messages: json.messages,
      response_format: zodResponseFormat(SetValuesSchema, 'setValues'),
    });
    response.json(result.choices[0].message.content);
  } catch (error: any) {
    if (error.response) {
      response.status(error.response.status).json(error.response.data);
    } else {
      response.status(400).json(error.message);
    }
  }
});

export default ai_chat_router;
