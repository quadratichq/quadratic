import { AnthropicBedrock } from '@anthropic-ai/bedrock-sdk';
import { Anthropic } from '@anthropic-ai/sdk';
import { AnthropicVertex } from '@anthropic-ai/vertex-sdk';
import { BedrockRuntimeClient } from '@aws-sdk/client-bedrock-runtime';
import { VertexAI } from '@google-cloud/vertexai';
import { GoogleAuth } from 'google-auth-library';
import { OpenAI } from 'openai';
import {
  ANTHROPIC_API_KEY,
  AWS_S3_ACCESS_KEY_ID,
  AWS_S3_REGION,
  AWS_S3_SECRET_ACCESS_KEY,
  BASETEN_API_KEY,
  GCP_CLIENT_EMAIL,
  GCP_PRIVATE_KEY,
  GCP_PROJECT_ID,
  GCP_REGION,
  GCP_REGION_ANTHROPIC,
  OPENAI_API_KEY,
  XAI_API_KEY,
} from '../env-vars';

const googleAuthOptions = {
  credentials: {
    project_id: GCP_PROJECT_ID,
    client_email: GCP_CLIENT_EMAIL,
    private_key: GCP_PRIVATE_KEY?.replace(/\\n/g, '\n'),
  },
  scopes: ['https://www.googleapis.com/auth/cloud-platform'],
};

// anthropic-sdk for gcp
export const vertex_anthropic = new AnthropicVertex({
  projectId: GCP_PROJECT_ID,
  region: GCP_REGION_ANTHROPIC,
  googleAuth: new GoogleAuth(googleAuthOptions),
});

// gcp-sdk for vertexai, generic for all models
export const vertexai = new VertexAI({
  project: GCP_PROJECT_ID,
  location: GCP_REGION,
  googleAuthOptions,
});

// anthropic-sdk for bedrock
export const bedrock_anthropic = new AnthropicBedrock({
  awsSecretKey: AWS_S3_SECRET_ACCESS_KEY,
  awsAccessKey: AWS_S3_ACCESS_KEY_ID,
  awsRegion: AWS_S3_REGION,
});

// aws-sdk for bedrock, generic for all models
export const bedrock = new BedrockRuntimeClient({
  region: AWS_S3_REGION,
  credentials: { accessKeyId: AWS_S3_ACCESS_KEY_ID, secretAccessKey: AWS_S3_SECRET_ACCESS_KEY },
});

export const anthropic = new Anthropic({
  apiKey: ANTHROPIC_API_KEY,
});

export const openai = new OpenAI({
  apiKey: OPENAI_API_KEY || '',
});

export const xai = new OpenAI({
  apiKey: XAI_API_KEY || '',
  baseURL: 'https://api.x.ai/v1',
});

export const baseten = new OpenAI({
  apiKey: BASETEN_API_KEY || '',
  baseURL: 'https://inference.baseten.co/v1',
});
