import express from 'express';
import cors from 'cors';
import { PrismaClient } from '@prisma/client';
import { validateAccessToken } from './middleware/auth';
import { Request as JWTRequest } from 'express-jwt';
import { z } from 'zod';
import { Configuration, OpenAIApi } from 'openai';
import rateLimit from 'express-rate-limit';

const prisma = new PrismaClient();

const app = express();
app.use(express.json());

// set CORS in production set as app.quadratichq.com
const origin = process.env.CORS || '*';
app.use(cors({ origin }));

const getUserFromRequest = async (req: JWTRequest) => {
  const user = await prisma.qUser.upsert({
    where: {
      auth0_user_id: req.auth?.sub,
    },
    update: {},
    create: {
      auth0_user_id: req.auth?.sub,
    },
  });
  return user;
};

const configuration = new Configuration({
  apiKey: process.env.OPENAI_API_KEY,
});
const openai = new OpenAIApi(configuration);

const limiter = rateLimit({
  windowMs: 3 * 60 * 60 * 1000, // 3 hours
  max: Number(process.env.RATE_LIMIT_AI_REQUESTS_PER_3_HOURS) || 25, // Limit number of requests per windowMs
  standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
  legacyHeaders: false, // Disable the `X-RateLimit-*` headers
  keyGenerator: (request: JWTRequest, response) => {
    return request.auth?.sub || 'anonymous';
  },
});

const AIMessage = z.object({
  // role can be only "user" or "bot"
  role: z.enum(['system', 'user', 'assistant']),
  content: z.string(),
});

const AIAutoCompleteRequestBody = z.object({
  messages: z.array(AIMessage),
  // optional model to use either "gpt-4" or "gpt-3-turbo"
  model: z.enum(['gpt-4', 'gpt-3-turbo']).optional(),
});

app.post('/ai/autocomplete', validateAccessToken, limiter, async (request: JWTRequest, response) => {
  const r_json = AIAutoCompleteRequestBody.parse(request.body);

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
        // console.error(error);
        response.status(500).send('Error streaming data');
      });
  } catch (error: any) {
    if (error.response) {
      response.status(error.response.status).json(error.response.data);
      // console.log(error.response.status);
      // console.log(error.response.data);
    } else {
      response.status(400).json(error.message);
      // console.log(error.message);
    }
  }
});

const PORT = process.env.PORT || 8000;

app.listen(PORT, () => console.log(`Listening on http://localhost:${PORT}`));
