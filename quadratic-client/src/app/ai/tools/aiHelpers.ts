import { AI_TOOLS, AITool } from '@/app/ai/tools/aiTools';
import { AnthropicTool, AnthropicToolChoice, OpenAITool, OpenAIToolChoice } from 'quadratic-shared/typesAndSchemasAI';

export const getTools = (isAnthropic: boolean): AnthropicTool[] | OpenAITool[] => {
  if (isAnthropic) {
    return Object.entries(AI_TOOLS).map(
      ([name, { description, parameters: input_schema }]): AnthropicTool => ({
        name,
        description,
        input_schema,
      })
    );
  }

  return Object.entries(AI_TOOLS).map(
    ([name, { description, parameters }]): OpenAITool => ({
      type: 'function',
      function: {
        name,
        description,
        parameters,
      },
    })
  );
};

export const getToolChoice = (isAnthropic: boolean, name?: AITool): AnthropicToolChoice | OpenAIToolChoice => {
  if (isAnthropic) {
    const toolChoice: AnthropicToolChoice = name === undefined ? { type: 'auto' } : { type: 'tool', name };
    return toolChoice;
  }

  const toolChoice: OpenAIToolChoice = name === undefined ? 'auto' : { type: 'function', function: { name } };
  return toolChoice;
};
