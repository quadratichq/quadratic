import { AITool as AIToolName } from '@/app/ai/tools/aiTools';
import { aiToolsSpec } from '@/app/ai/tools/aiToolsSpec';
import {
  AIModel,
  AITool,
  AIToolChoice,
  AnthropicTool,
  AnthropicToolChoice,
  BedrockTool,
  BedrockToolChoice,
  OpenAITool,
  OpenAIToolChoice,
} from 'quadratic-shared/typesAndSchemasAI';
import { isAnthropicModel, isBedrockModel, isOpenAIModel } from './model.helper';

export const getTools = (model: AIModel, toolChoice?: AIToolName): AITool[] => {
  const tools = Object.entries(aiToolsSpec).filter(([name, toolSpec]) => {
    if (toolChoice === undefined) {
      return !toolSpec.internalTool;
    }
    return name === toolChoice;
  });

  if (isBedrockModel(model)) {
    return tools.map(
      ([name, { description, parameters: input_schema }]): BedrockTool => ({
        toolSpec: {
          name,
          description,
          inputSchema: {
            json: input_schema,
          },
        },
      })
    );
  }

  if (isAnthropicModel(model)) {
    return tools.map(
      ([name, { description, parameters: input_schema }]): AnthropicTool => ({
        name,
        description,
        input_schema,
      })
    );
  }

  if (isOpenAIModel(model)) {
    return tools.map(
      ([name, { description, parameters }]): OpenAITool => ({
        type: 'function' as const,
        function: {
          name,
          description,
          parameters,
          strict: true,
        },
      })
    );
  }

  throw new Error(`Unknown model: ${model}`);
};

export const getToolChoice = (model: AIModel, name?: AIToolName): AIToolChoice => {
  if (isBedrockModel(model)) {
    const toolChoice: BedrockToolChoice = name === undefined ? { auto: {} } : { tool: { name } };
    return toolChoice;
  }

  if (isAnthropicModel(model)) {
    const toolChoice: AnthropicToolChoice = name === undefined ? { type: 'auto' } : { type: 'tool', name };
    return toolChoice;
  }

  if (isOpenAIModel(model)) {
    const toolChoice: OpenAIToolChoice = name === undefined ? 'auto' : { type: 'function', function: { name } };
    return toolChoice;
  }

  throw new Error(`Unknown model: ${model}`);
};
