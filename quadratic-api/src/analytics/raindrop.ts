import { Raindrop } from 'raindrop-ai';
import OpenAI from 'openai';
import * as AnthropicModule from '@anthropic-ai/sdk';
import { RAINDROP_API_KEY, NODE_ENV } from '../env-vars';

export let raindrop: Raindrop | null = null;
if (RAINDROP_API_KEY) {
  raindrop = new Raindrop({
    writeKey: RAINDROP_API_KEY,
    // Enable debug logs in non-production environments
    debugLogs: NODE_ENV !== 'production',
    // Disable in test environment
    disabled: NODE_ENV === 'test',
    // Instrument AI modules for automatic tracing
    instrumentModules: {
      openAI: OpenAI,
      anthropic: AnthropicModule,
    },
  });
}
