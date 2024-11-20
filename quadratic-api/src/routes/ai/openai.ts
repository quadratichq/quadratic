import express from 'express';
import OpenAI from 'openai';
import { MODEL_OPTIONS } from 'quadratic-shared/AI_MODELS';
import { OpenAIAutoCompleteRequestBodySchema } from 'quadratic-shared/typesAndSchemasAI';
import { OPENAI_API_KEY } from '../../env-vars';
import { validateAccessToken } from '../../middleware/validateAccessToken';
import { Request } from '../../types/Request';
import { ai_rate_limiter } from './aiRateLimiter';

const openai_router = express.Router();

const openai = new OpenAI({
  apiKey: OPENAI_API_KEY || '',
});

openai_router.post('/openai/chat', validateAccessToken, ai_rate_limiter, async (request, response) => {
  try {
    const { model, messages, tools, tool_choice } = OpenAIAutoCompleteRequestBodySchema.parse(request.body);
    const { temperature } = MODEL_OPTIONS[model];
    const result = await openai.chat.completions.create({
      model,
      messages,
      temperature,
      tools,
      tool_choice,
    });
    response.json(result.choices[0].message);
  } catch (error: any) {
    if (error instanceof OpenAI.APIError) {
      response.status(error.status ?? 400).json(error.message);
      console.log(error.status, error.message);
    } else {
      response.status(400).json(error);
      console.log(error);
    }
  }
});

openai_router.post('/openai/chat/stream', validateAccessToken, ai_rate_limiter, async (request: Request, response) => {
  try {
    const { model, messages, tools, tool_choice } = OpenAIAutoCompleteRequestBodySchema.parse(request.body);
    const { temperature } = MODEL_OPTIONS[model];
    const completion = await openai.chat.completions.create({
      model,
      messages,
      temperature,
      stream: true,
      tools,
      tool_choice,
    });

    response.setHeader('Content-Type', 'text/event-stream');
    response.setHeader('Cache-Control', 'no-cache');
    response.setHeader('Connection', 'keep-alive');
    for await (const chunk of completion) {
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
      if (error instanceof OpenAI.APIError) {
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
});

export default openai_router;
