import { AnthropicTool, AnthropicToolChoice, OpenAITool, OpenAIToolChoice } from 'quadratic-shared/typesAndSchemasAI';
import { z } from 'zod';

export const AI_TOOL_DEFINITIONS = {
  set_ai_researcher_value: {
    description: 'Sets the result of the AI Researcher as a value on the spreadsheet',
    parameters: {
      type: 'object',
      properties: {
        cell_value: {
          type: 'string',
          description:
            'This is the value that will be set on the spreadsheet. It can be a text, number, currency, date, etc.',
        },
      },
    },
    required: ['cell_value'],
    responseSchema: z.object({
      cell_value: z.string(),
    }),
  },
} as const;

export const anthropicTools: AnthropicTool[] = Object.entries(AI_TOOL_DEFINITIONS).map(
  ([name, { description, parameters: input_schema, required }]) => ({
    name,
    description,
    input_schema,
    required,
  })
);

export const openAITools: OpenAITool[] = Object.entries(AI_TOOL_DEFINITIONS).map(
  ([name, { description, parameters, required }]) => ({
    type: 'function',
    function: {
      name,
      description,
      parameters,
      required,
    },
  })
);

export function getAnthropicToolChoice(name?: keyof typeof AI_TOOL_DEFINITIONS): AnthropicToolChoice {
  if (!name) return { type: 'auto' };
  return { type: 'tool', name };
}

export function getOpenAIToolChoice(name?: keyof typeof AI_TOOL_DEFINITIONS): OpenAIToolChoice {
  if (!name) return 'auto';
  return { type: 'function', function: { name } };
}
