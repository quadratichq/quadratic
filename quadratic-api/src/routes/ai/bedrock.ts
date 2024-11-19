import { AnthropicBedrock } from '@anthropic-ai/bedrock-sdk';
import { BedrockRuntimeClient, ConverseCommand, ConverseStreamCommand } from '@aws-sdk/client-bedrock-runtime';
import express from 'express';
import { MODEL_OPTIONS } from 'quadratic-shared/AI_MODELS';
import {
  BedrockAnthropicAutoCompleteRequestBodySchema,
  BedrockAutoCompleteRequestBodySchema,
} from 'quadratic-shared/typesAndSchemasAI';
import { AWS_S3_ACCESS_KEY_ID, AWS_S3_REGION, AWS_S3_SECRET_ACCESS_KEY } from '../../env-vars';
import { validateAccessToken } from '../../middleware/validateAccessToken';
import { Request } from '../../types/Request';
import { ai_rate_limiter } from './aiRateLimiter';

const bedrock_router = express.Router();

// aws-sdk for bedrock, generic for all models
const bedrock = new BedrockRuntimeClient({
  region: AWS_S3_REGION,
  credentials: { accessKeyId: AWS_S3_ACCESS_KEY_ID, secretAccessKey: AWS_S3_SECRET_ACCESS_KEY },
});

// anthropic-sdk for bedrock
const bedrock_anthropic = new AnthropicBedrock({
  awsSecretKey: AWS_S3_SECRET_ACCESS_KEY,
  awsAccessKey: AWS_S3_ACCESS_KEY_ID,
  awsRegion: AWS_S3_REGION,
});

bedrock_router.post('/bedrock/chat', validateAccessToken, ai_rate_limiter, async (request, response) => {
  try {
    const { model, system, messages, tools, tool_choice } = BedrockAutoCompleteRequestBodySchema.parse(request.body);
    const { temperature, max_tokens } = MODEL_OPTIONS[model];
    const command = new ConverseCommand({
      modelId: model,
      system,
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
      const { model, system, messages, tools, tool_choice } = BedrockAutoCompleteRequestBodySchema.parse(request.body);
      const { temperature, max_tokens } = MODEL_OPTIONS[model];
      const command = new ConverseStreamCommand({
        modelId: model,
        system,
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

// anthropic-sdk for bedrock
bedrock_router.post('/bedrock/anthropic/chat', validateAccessToken, ai_rate_limiter, async (request, response) => {
  try {
    const { model, system, messages, tools, tool_choice } = BedrockAnthropicAutoCompleteRequestBodySchema.parse(
      request.body
    );
    const { temperature, max_tokens } = MODEL_OPTIONS[model];
    const result = await bedrock_anthropic.messages.create({
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

// anthropic-sdk for bedrock
bedrock_router.post(
  '/bedrock/anthropic/chat/stream',
  validateAccessToken,
  ai_rate_limiter,
  async (request: Request, response) => {
    try {
      const { model, system, messages, tools, tool_choice } = BedrockAnthropicAutoCompleteRequestBodySchema.parse(
        request.body
      );
      const { temperature, max_tokens } = MODEL_OPTIONS[model];
      const chunks = await bedrock_anthropic.messages.create({
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

export default bedrock_router;
