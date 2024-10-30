import { AITool } from '@/app/ai/tools/aiTools';
import { sheets } from '@/app/grid/controller/Sheets';
import { ensureRectVisible } from '@/app/gridGL/interaction/viewportHelper';
import { quadraticCore } from '@/app/web-workers/quadraticCore/quadraticCore';
import { AIToolArgs } from 'quadratic-shared/typesAndSchemasAI';
import { z } from 'zod';

type AIToolSpec<T extends keyof typeof AIToolsArgsSchema> = {
  internalTool: boolean; // tools meant to get structured data from AI, but meant to be used during chat
  description: string;
  parameters: {
    type: 'object';
    properties: Record<string, AIToolArgs>;
    required: string[];
  };
  responseSchema: (typeof AIToolsArgsSchema)[T];
  action: (args: z.infer<(typeof AIToolsArgsSchema)[T]>) => Promise<string>;
  prompt: string;
};

export const AIToolsArgsSchema = {
  [AITool.SetCodeCellValue]: z.object({
    language: z.enum(['Python', 'Javascript', 'Formula']),
    x: z.number(),
    y: z.number(),
    codeString: z.string(),
    width: z.number(),
    height: z.number(),
  }),
  [AITool.SetCellValues]: z.object({
    x: z.number(),
    y: z.number(),
    values: z.array(z.array(z.string())),
  }),
  [AITool.SetChatName]: z.object({
    name: z.string(),
  }),
} as const;

export type AIToolSpecRecord = {
  [K in AITool]: AIToolSpec<K>;
};

export const aiToolsSpec: AIToolSpecRecord = {
  [AITool.SetCodeCellValue]: {
    internalTool: false,
    description:
      'Set the value of a code cell and run it in the spreadsheet, requires the cell position (x, y), codeString and language',
    parameters: {
      type: 'object',
      properties: {
        language: {
          type: 'string',
          description:
            'The language of the code cell, this can be one of Python, Javascript or Formula. This is case sensitive.',
        },
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
        width: {
          type: 'number',
          description: 'The width, i.e. number of columns, of the code output on running this Code in spreadsheet',
        },
        height: {
          type: 'number',
          description: 'The height, i.e. number of rows, of the code output on running this Code in spreadsheet',
        },
      },
      required: ['language', 'x', 'y', 'codeString', 'width', 'height'],
    },
    responseSchema: AIToolsArgsSchema[AITool.SetCodeCellValue],
    action: async (args) => {
      const { language, codeString, x, y, width, height } = args;
      quadraticCore.setCodeCellValue({
        sheetId: sheets.current,
        x,
        y,
        codeString,
        language,
        cursor: sheets.getCursorPosition(),
      });
      ensureRectVisible({ x, y }, { x: x + width - 1, y: y + height - 1 });
      return 'Executed set code cell value tool successfully';
    },
    prompt: `       
You can use the SetCodeCellValue function to set this code cell value. Use this function instead of responding with code.

This function requires language, codeString, the cell position (x, y) and the width and height of the code output on running this Code in spreadsheet.

The required location (x,y) for this code cell is one which satisfies the following conditions:
 - The code cell location (x,y) should be empty and should have enough space to the right and below to accommodate the code result. If there is a value in a single cell where the code result is suppose to go, it will result in spill error. Use current sheet context to identify empty space.
 - The code cell should be near the data it references, so that it is easy to understand the code in the context of the data. Identify the data being referred from code and use a cell close to it. If multiple data references are being made, choose the one which is most used or most important. This will make it easy to understand the code in the context of the table.
 - If the referenced data is portrait in a table format, the code cell should be next to the top right corner of the table.
 - If the referenced data is landscape in a table format, the code cell should be below the bottom left corner of the table.
 - Always leave a blank row / column between the code cell and the data it references.
 - In case there is not enough empty space near the referenced data, choose a distant empty cell which is in the same row as the top right corner of referenced data and to the right of this data.
 - If there are multiple tables or data sources being referenced, place the code cell in a location that provides a good balance between proximity to all referenced data and maintaining readability of the sheet.
 - Consider the overall layout and organization of the sheet when placing the code cell, ensuring it doesn't disrupt existing data or interfere with other code cells.
`,
  },
  [AITool.SetCellValues]: {
    internalTool: false,
    description:
      'Set the values of a spreadsheet cells to a 2d array of strings, requires the cell position (x, y) and the 2d array of strings. Values are string representation of text, number, logical, time instant, duration, error, html, code, image, date, time or blank.',
    parameters: {
      type: 'object',
      properties: {
        x: {
          type: 'number',
          description:
            'The x position of the cell, which is the column index of the current spreadsheet. This is the column index of the top left corner of the added 2d array of values on the spreadsheet',
        },
        y: {
          type: 'number',
          description:
            'The y position of the cell, which is the row index of the current spreadsheet. This is the row index of the top left corner of the added 2d array of values on the spreadsheet',
        },
        values: {
          type: 'array',
          items: {
            type: 'array',
            items: {
              type: 'string',
              description: 'The string that is the value to set in the cell',
            },
          },
        },
      },
      required: ['x', 'y', 'values'],
    },
    responseSchema: AIToolsArgsSchema[AITool.SetCellValues],
    action: async (args) => {
      const { x, y, values } = args;
      quadraticCore.setCellValues(sheets.current, x, y, values, sheets.getCursorPosition());
      return 'Executed set cell values tool successfully';
    },
    prompt: `
You can use the SetCellValues function to set the values of a spreadsheet cells to a 2d array of strings.

This function requires the cell position (x, y) and the 2d array of strings. Values are string representation of text, number, logical, time instant, duration, error, html, code, image, date, time or blank.
`,
  },
  [AITool.SetChatName]: {
    internalTool: true,
    description: 'Set the name of the user chat with AI assistant, this is the name of the chat in the chat history',
    parameters: {
      type: 'object',
      properties: {
        name: {
          type: 'string',
          description: 'The name of the chat',
        },
      },
      required: ['name'],
    },
    responseSchema: AIToolsArgsSchema[AITool.SetChatName],
    action: async (args) => {
      // no action as this tool is only meant to get structured data from AI
      return `Executed set chat name tool successfully with name: ${args.name}`;
    },
    prompt: `
You can use the SetChatName function to set the name of the user chat with AI assistant, this is the name of the chat in the chat history.\n
This function requires the name of the chat, this should be concise and descriptive of the conversation, and should be easily understandable by a non-technical user.\n
The chat name should be based on user's messages and should reflect his/her queries and goals.\n
This name should be from user's perspective, not the assistant's.\n
`,
  },
} as const;
