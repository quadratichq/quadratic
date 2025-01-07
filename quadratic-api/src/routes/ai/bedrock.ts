import { AnthropicBedrock } from '@anthropic-ai/bedrock-sdk';
import Anthropic from '@anthropic-ai/sdk';
import { BedrockRuntimeClient, ConverseCommand, ConverseStreamCommand } from '@aws-sdk/client-bedrock-runtime';
import { type Response } from 'express';
import { getModelOptions, isBedrockAnthropicModel } from 'quadratic-shared/ai/helpers/model.helper';
import {
  type AIAutoCompleteRequestBody,
  type AIMessagePrompt,
  type BedrockModel,
} from 'quadratic-shared/typesAndSchemasAI';
import { AWS_S3_ACCESS_KEY_ID, AWS_S3_REGION, AWS_S3_SECRET_ACCESS_KEY } from '../../env-vars';
import { getAnthropicApiArgs, parseAnthropicResponse, parseAnthropicStream } from './helpers/anthropic.helper';
import { getBedrockApiArgs, parseBedrockResponse, parseBedrockStream } from './helpers/bedrock.helper';

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

export const handleBedrockRequest = async (
  model: BedrockModel,
  args: Omit<AIAutoCompleteRequestBody, 'model'>,
  response: Response
): Promise<AIMessagePrompt | undefined> => {
  const { stream, temperature, max_tokens } = getModelOptions(model, args);

  if (isBedrockAnthropicModel(model)) {
    const { system, messages, tools, tool_choice } = getAnthropicApiArgs(args);
    if (stream) {
      try {
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

        const responseMessage = await parseAnthropicStream(chunks, response);
        return responseMessage;
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
          console.error('Error occurred after headers were sent:', error);
        }
      }
    } else {
      try {
        const result = await bedrock_anthropic.messages.create({
          model,
          system,
          messages,
          temperature,
          max_tokens,
          tools,
          tool_choice,
        });
        const responseMessage = parseAnthropicResponse(result, response);
        return responseMessage;
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
  } else {
    const { system, messages, tools, tool_choice } = getBedrockApiArgs(args);
    if (stream) {
      try {
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

        const responseMessage = await parseBedrockStream(chunks, response);
        return responseMessage;
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
    } else {
      try {
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
        const responseMessage = parseBedrockResponse(result.output, response);
        return responseMessage;
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
  }
};
