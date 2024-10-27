import { BedrockRuntimeClient, ConverseCommand, ConverseStreamCommand } from '@aws-sdk/client-bedrock-runtime';
import express from 'express';
import rateLimit from 'express-rate-limit';
import { BedrockAutoCompleteRequestBodySchema } from 'quadratic-shared/typesAndSchemasAI';
import {
  AWS_AI_ACCESS_KEY_ID,
  AWS_AI_REGION,
  AWS_AI_SECRET_ACCESS_KEY,
  RATE_LIMIT_AI_REQUESTS_MAX,
  RATE_LIMIT_AI_WINDOW_MS,
} from '../../env-vars';
import { validateAccessToken } from '../../middleware/validateAccessToken';
import { Request } from '../../types/Request';

const bedrock_router = express.Router();

const bedrock = new BedrockRuntimeClient({
  region: AWS_AI_REGION,
  credentials: { accessKeyId: AWS_AI_ACCESS_KEY_ID, secretAccessKey: AWS_AI_SECRET_ACCESS_KEY },
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

bedrock_router.post('/bedrock/chat', validateAccessToken, ai_rate_limiter, async (request, response) => {
  try {
    const { model, messages, temperature, max_tokens, tools, tool_choice } = BedrockAutoCompleteRequestBodySchema.parse(
      request.body
    );

    const command = new ConverseCommand({
      modelId: model,
      messages,
      inferenceConfig: { maxTokens: max_tokens, temperature },
      toolConfig: tools &&
        tool_choice && {
          tools,
          toolChoice: tool_choice,
        },
    });

    const result = await bedrock.send(command);
    response.json(result.output);
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

bedrock_router.post(
  '/bedrock/chat/stream',
  validateAccessToken,
  ai_rate_limiter,
  async (request: Request, response) => {
    try {
      const { model, messages, temperature, max_tokens, tools, tool_choice } =
        BedrockAutoCompleteRequestBodySchema.parse(request.body);
      const command = new ConverseStreamCommand({
        modelId: model,
        messages,
        inferenceConfig: { maxTokens: max_tokens, temperature },
        toolConfig: tools &&
          tool_choice && {
            tools,
            toolChoice: tool_choice,
          },
      });

      const chunks = (await bedrock.send(command)).stream ?? [];

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

export default bedrock_router;
