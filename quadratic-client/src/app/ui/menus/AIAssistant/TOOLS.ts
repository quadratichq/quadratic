import { AnthropicTool, AnthropicToolChoice, OpenAITool, OpenAIToolChoice } from 'quadratic-shared/typesAndSchemasAI';
import { z } from 'zod';

export const AI_TOOL_DEFINITIONS = {
  SetCodeCellValue: {
    description: 'Set the value of a code cell, requires the cell position (x, y), codeString and language',
    parameters: {
      type: 'object',
      properties: {
        x: {
          type: 'number',
          description: 'The x position of the cell, which is the column index of the current spreadsheet',
        },
        y: {
          type: 'number',
          description: 'The y position of the cell, which is the row index of the current spreadsheet',
        },
        codeString: {
          type: 'string',
          description: 'The code which will run in the cell',
        },
        language: {
          type: 'string',
          description:
            'The language of the code cell, this can be one of Python, Javascript or Formula. This is case sensitive.',
        },
      },
    },
    responseSchema: z.object({
      x: z.number(),
      y: z.number(),
      codeString: z.string(),
      language: z.enum(['Python', 'Javascript', 'Formula']),
    }),
  },
} as const;

export const anthropicTools: AnthropicTool[] = Object.entries(AI_TOOL_DEFINITIONS).map(
  ([name, { description, parameters }]) => ({
    name,
    description,
    input_schema: parameters,
  })
);

export const openAITools: OpenAITool[] = Object.entries(AI_TOOL_DEFINITIONS).map(
  ([name, { description, parameters }]) => ({
    type: 'function',
    function: {
      name,
      description,
      parameters,
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
