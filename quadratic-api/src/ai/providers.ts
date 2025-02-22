import AnthropicBedrock from '@anthropic-ai/bedrock-sdk';
import Anthropic from '@anthropic-ai/sdk';
import { BedrockRuntimeClient } from '@aws-sdk/client-bedrock-runtime';
import OpenAI from 'openai';
import {
  ANTHROPIC_API_KEY,
  AWS_S3_ACCESS_KEY_ID,
  AWS_S3_REGION,
  AWS_S3_SECRET_ACCESS_KEY,
  OPENAI_API_KEY,
  XAI_API_KEY,
} from '../env-vars';

// aws-sdk for bedrock, generic for all models
export const bedrock = new BedrockRuntimeClient({
  region: AWS_S3_REGION,
  credentials: { accessKeyId: AWS_S3_ACCESS_KEY_ID, secretAccessKey: AWS_S3_SECRET_ACCESS_KEY },
});

// anthropic-sdk for bedrock
export const bedrock_anthropic = new AnthropicBedrock({
  awsSecretKey: AWS_S3_SECRET_ACCESS_KEY,
  awsAccessKey: AWS_S3_ACCESS_KEY_ID,
  awsRegion: AWS_S3_REGION,
});

export const anthropic = new Anthropic({
  apiKey: ANTHROPIC_API_KEY,
});

export const xai = new OpenAI({
  apiKey: XAI_API_KEY || '',
  baseURL: 'https://api.x.ai/v1',
});

export const openai = new OpenAI({
  apiKey: OPENAI_API_KEY || '',
});
