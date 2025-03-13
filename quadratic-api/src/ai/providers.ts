import { AnthropicBedrock } from '@anthropic-ai/bedrock-sdk';
import { Anthropic } from '@anthropic-ai/sdk';
import { AnthropicVertex } from '@anthropic-ai/vertex-sdk';
import { BedrockRuntimeClient } from '@aws-sdk/client-bedrock-runtime';
import { OpenAI } from 'openai';
import {
  ANTHROPIC_API_KEY,
  AWS_S3_ACCESS_KEY_ID,
  AWS_S3_REGION,
  AWS_S3_SECRET_ACCESS_KEY,
  GCP_API_KEY_DEVELOPMENT,
  GCP_PROJECT_ID,
  GCP_REGION,
  OPENAI_API_KEY,
  XAI_API_KEY,
} from '../env-vars';

// Reads from the `CLOUD_ML_REGION` & `ANTHROPIC_VERTEX_PROJECT_ID` environment variables.
// Additionally goes through the standard `google-auth-library` flow.
export const vertex_anthropic = new AnthropicVertex({
  region: GCP_REGION,
  projectId: GCP_PROJECT_ID,
  accessToken: GCP_API_KEY_DEVELOPMENT,
});

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
