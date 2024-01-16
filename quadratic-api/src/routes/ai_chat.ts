import express from 'express';
import { validateAccessToken } from '../middleware/validateAccessToken';
import { Request } from '../types/Request';

import rateLimit from 'express-rate-limit';
import { Configuration, OpenAIApi } from 'openai';
import { z } from 'zod';

const ai_chat_router = express.Router();

const configuration = new Configuration({
  apiKey: process.env.OPENAI_API_KEY,
});
const openai = new OpenAIApi(configuration);

const ai_rate_limiter = rateLimit({
  windowMs: Number(process.env.RATE_LIMIT_AI_WINDOW_MS) || 3 * 60 * 60 * 1000, // 3 hours
  max: Number(process.env.RATE_LIMIT_AI_REQUESTS_MAX) || 25, // Limit number of requests per windowMs
  standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
  legacyHeaders: false, // Disable the `X-RateLimit-*` headers
  keyGenerator: (request: Request) => {
    return request.auth?.sub || 'anonymous';
  },
});

const AIMessage = z.object({
  // role can be only "user" or "bot"
  role: z.enum(['system', 'user', 'assistant']),
  content: z.string(),
  stream: z.boolean().optional(),
});

const AIAutoCompleteRequestBody = z.object({
  messages: z.array(AIMessage),
  // optional model
  model: z.enum(['gpt-4', 'gpt-3-turbo', 'gpt-4-32k']).optional(),
});

type AIAutoCompleteRequestBodyType = z.infer<typeof AIAutoCompleteRequestBody>;

const log_ai_request = (req: any, req_json: AIAutoCompleteRequestBodyType) => {
  const to_log = req_json.messages.filter((message) => message.role !== AIMessage.shape.role.Values.system);
  console.log('API Chat Request: ', req?.auth?.sub, to_log);
};

ai_chat_router.post('/chat', validateAccessToken, ai_rate_limiter, async (request, response) => {
  const r_json = AIAutoCompleteRequestBody.parse(request.body);

  log_ai_request(request, r_json);

  try {
    const result = await openai.createChatCompletion({
      model: r_json.model || 'gpt-4',
      messages: r_json.messages,
    });

    response.json({
      data: result.data,
    });
  } catch (error: any) {
    if (error.response) {
      response.status(error.response.status).json(error.response.data);
    } else {
      response.status(400).json(error.message);
    }
  }
});

ai_chat_router.post('/chat/stream', validateAccessToken, ai_rate_limiter, async (request: Request, response) => {
  const r_json = AIAutoCompleteRequestBody.parse(request.body);

  log_ai_request(request, r_json);

  response.setHeader('Content-Type', 'text/event-stream');
  response.setHeader('Cache-Control', 'no-cache');
  response.setHeader('Connection', 'keep-alive');

  try {
    await openai
      .createChatCompletion(
        {
          model: r_json.model || 'gpt-4',
          messages: r_json.messages,
          stream: true,
        },
        { responseType: 'stream' }
      )
      .then((oai_response: any) => {
        // Pipe the response from axios to the SSE response
        oai_response.data.pipe(response);
      })
      .catch((error: any) => {
        console.error(error);
        response.status(500).send('Error streaming data');
      });
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

export default ai_chat_router;
