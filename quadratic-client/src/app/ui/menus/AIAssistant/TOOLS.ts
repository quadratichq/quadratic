import { AnthropicTool, AnthropicToolChoice, OpenAITool, OpenAIToolChoice } from 'quadratic-shared/typesAndSchemasAI';
import { z } from 'zod';

export const AI_TOOL_DEFINITIONS = {
  SetCodeCellValue: {
    description: 'Set the value of a code cell, requires the cell position (x, y), codeString and language',
    parameters: {
      type: 'object',
      properties: {
        language: {
          type: 'string',
          description:
            'The language of the code cell, this can be one of Python, Javascript or Formula. This is case sensitive.',
        },
        codeString: {
          type: 'string',
          description: 'The code which will run in the cell',
        },
        x: {
          type: 'number',
          description: 'The x position of the cell, which is the column index of the current spreadsheet',
        },
        y: {
          type: 'number',
          description: 'The y position of the cell, which is the row index of the current spreadsheet',
        },
        width: {
          type: 'number',
          description: 'The width, i.e. number of columns, of the code output on running this Code in spreadsheet',
        },
        height: {
          type: 'number',
          description: 'The height, i.e. number of rows, of the code output on running this Code in spreadsheet',
        },
      },
    },
    required: ['language', 'codeString', 'x', 'y', 'width', 'height'],
    responseSchema: z.object({
      language: z.enum(['Python', 'Javascript', 'Formula']),
      codeString: z.string(),
      x: z.number(),
      y: z.number(),
      width: z.number(),
      height: z.number(),
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
