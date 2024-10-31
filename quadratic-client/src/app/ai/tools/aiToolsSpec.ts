import { AITool } from '@/app/ai/tools/aiTools';
import { sheets } from '@/app/grid/controller/Sheets';
import { ensureRectVisible } from '@/app/gridGL/interaction/viewportHelper';
import { Selection, SheetRect } from '@/app/quadratic-core-types';
import { quadraticCore } from '@/app/web-workers/quadraticCore/quadraticCore';
import { AIToolArgs } from 'quadratic-shared/typesAndSchemasAI';
import { z } from 'zod';

type AIToolSpec<T extends keyof typeof AIToolsArgsSchema> = {
  internalTool: boolean; // tools meant to get structured data from AI, but meant to be used during chat
  description: string; // this is sent with tool definition, has a maximum character limit
  parameters: {
    type: 'object';
    properties: Record<string, AIToolArgs>;
    required: string[];
    additionalProperties: boolean;
  };
  responseSchema: (typeof AIToolsArgsSchema)[T];
  action: (args: z.infer<(typeof AIToolsArgsSchema)[T]>) => Promise<string>;
  prompt: string; // this is sent as internal message to AI, no character limit
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
  [AITool.MoveCells]: z.object({
    sourceTopLeftX: z.number(),
    sourceTopLeftY: z.number(),
    sourceBottomRightX: z.number(),
    sourceBottomRightY: z.number(),
    targetTopLeftX: z.number(),
    targetTopLeftY: z.number(),
  }),
  [AITool.DeleteCells]: z.object({
    rects: z.array(
      z.object({
        topLeftX: z.number(),
        topLeftY: z.number(),
        width: z.number(),
        height: z.number(),
      })
    ),
  }),
} as const;

export type AIToolSpecRecord = {
  [K in AITool]: AIToolSpec<K>;
};

export const aiToolsSpec: AIToolSpecRecord = {
  [AITool.SetCodeCellValue]: {
    internalTool: false,
    description: `
Sets the value of a code cell and run it in the spreadsheet, requires the cell position (x, y), codeString and language\n
You should use the SetCodeCellValue function to set this code cell value. Use this function instead of responding with code.\n
Always refer to the cell by its (x,y) position from the spreadsheet. Don't add values manually in code cells.\n
`,
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
      additionalProperties: false,
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
You should use the SetCodeCellValue function to set this code cell value. Use this function instead of responding with code.\n
This function requires language, codeString, the cell position (x, y) and the width and height of the code output on running this Code in spreadsheet.\n
Always refer to the cell by its (x,y) position from the spreadsheet. Don't add values manually in code cells.\n
The required location (x,y) for this code cell is one which satisfies the following conditions:\n
 - The code cell location (x,y) should be empty and should have enough space to the right and below to accommodate the code result. If there is a value in a single cell where the code result is suppose to go, it will result in spill error. Use current sheet context to identify empty space.\n
 - The code cell should be near the data it references, so that it is easy to understand the code in the context of the data. Identify the data being referred from code and use a cell close to it. If multiple data references are being made, choose the one which is most used or most important. This will make it easy to understand the code in the context of the table.\n
 - If the referenced data is portrait in a table format, the code cell should be next to the top right corner of the table.\n
 - If the referenced data is landscape in a table format, the code cell should be below the bottom left corner of the table.\n
 - Always leave a blank row / column between the code cell and the data it references.\n
 - In case there is not enough empty space near the referenced data, choose a distant empty cell which is in the same row as the top right corner of referenced data and to the right of this data.\n
 - If there are multiple tables or data sources being referenced, place the code cell in a location that provides a good balance between proximity to all referenced data and maintaining readability of the sheet.\n
 - Consider the overall layout and organization of the sheet when placing the code cell, ensuring it doesn't disrupt existing data or interfere with other code cells.\n
 - A plot returned by the code cell occupies just one cell, the plot overlay is larger but the code cell is always just one cell.\n
 `,
  },
  [AITool.SetCellValues]: {
    internalTool: false,
    description: `
Sets the values of a spreadsheet cells to a 2d array of strings, requires the cell position (x, y) and the 2d array of strings.
Values are string representation of text, number, logical, time instant, duration, error, html, code, image, date, time or blank.\n
(x,y) is the position of the top left corner of the 2d array of values on the spreadsheet. Each sub array represents a row of values.\n
All values can be referenced in the code cells immediately. Always refer to the cell by its (x,y) position. Don't add values manually in code cells.\n
To clear the values of a cell, set the value to an empty string.\n
`,
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
      additionalProperties: false,
    },
    responseSchema: AIToolsArgsSchema[AITool.SetCellValues],
    action: async (args) => {
      const { x, y, values } = args;
      quadraticCore.setCellValues(sheets.current, x, y, values, sheets.getCursorPosition());
      return 'Executed set cell values tool successfully';
    },
    prompt: `
You should use the SetCellValues function to set the values of a spreadsheet cells to a 2d array of strings.\n
This function requires the cell position (x, y) and the 2d array of strings. Values are string representation of text, number, logical, time instant, duration, error, html, code, image, date, time or blank.\n
Values set using this function will replace the existing values in the cell and can be referenced in the code cells immediately. Always refer to the cell by its (x,y) position. Don't add these in code cells.\n
To clear the values of a cell, set the value to an empty string.\n
`,
  },
  [AITool.SetChatName]: {
    internalTool: true,
    description: `
Set the name of the user chat with AI assistant, this is the name of the chat in the chat history\n
You should use the SetChatName function to set the name of the user chat with AI assistant, this is the name of the chat in the chat history.\n
This function requires the name of the chat, this should be concise and descriptive of the conversation, and should be easily understandable by a non-technical user.\n
The chat name should be based on user's messages and should reflect his/her queries and goals.\n
This name should be from user's perspective, not the assistant's.\n
`,
    parameters: {
      type: 'object',
      properties: {
        name: {
          type: 'string',
          description: 'The name of the chat',
        },
      },
      required: ['name'],
      additionalProperties: false,
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
  [AITool.MoveCells]: {
    internalTool: false,
    description: `
Moves a rectangular selection of cells from one location to another on the spreadsheet, requires the source and target locations.\n
You should use the MoveCells function to move a rectangular selection of cells from one location to another on the spreadsheet.\n
This function requires the source and target locations. Source location is the top left and bottom right corners of the selection rectangle to be moved.\n
Target location is the top left corner of the target location on the spreadsheet.\n
`,
    parameters: {
      type: 'object',
      properties: {
        sourceTopLeftX: {
          type: 'number',
          description:
            'The x position of the cell, which is the column index of the current spreadsheet. This is the column index of the top left corner of the rectangular selection of cells to move',
        },
        sourceTopLeftY: {
          type: 'number',
          description:
            'The y position of the cell, which is the row index of the current spreadsheet. This is the row index of the top left corner of the rectangular selection of cells to move',
        },
        sourceBottomRightX: {
          type: 'number',
          description:
            'The x position of the cell, which is the column index of the current spreadsheet. This is the column index of the bottom right corner of the rectangular selection of cells to move',
        },
        sourceBottomRightY: {
          type: 'number',
          description:
            'The y position of the cell, which is the row index of the current spreadsheet. This is the row index of the bottom right corner of the rectangular selection of cells to move',
        },
        targetTopLeftX: {
          type: 'number',
          description:
            'The x position of the cell, which is the column index of the current spreadsheet. This is the column index of the top left corner of the target location on the spreadsheet',
        },
        targetTopLeftY: {
          type: 'number',
          description:
            'The y position of the cell, which is the row index of the current spreadsheet. This is the row index of the top left corner of the target location on the spreadsheet',
        },
      },
      required: [
        'sourceTopLeftX',
        'sourceTopLeftY',
        'sourceBottomRightX',
        'sourceBottomRightY',
        'targetTopLeftX',
        'targetTopLeftY',
      ],
      additionalProperties: false,
    },
    responseSchema: AIToolsArgsSchema[AITool.MoveCells],
    action: async (args) => {
      const { sourceTopLeftX, sourceTopLeftY, sourceBottomRightX, sourceBottomRightY, targetTopLeftX, targetTopLeftY } =
        args;
      const sheetRect: SheetRect = {
        min: {
          x: BigInt(sourceTopLeftX),
          y: BigInt(sourceTopLeftY),
        },
        max: {
          x: BigInt(sourceBottomRightX),
          y: BigInt(sourceBottomRightY),
        },
        sheet_id: {
          id: sheets.current,
        },
      };
      quadraticCore.moveCells(sheetRect, targetTopLeftX, targetTopLeftY, sheets.current);
      return `Executed move cells tool successfully.`;
    },
    prompt: `
You should use the MoveCells function to move a rectangular selection of cells from one location to another on the spreadsheet.\n
This function requires the source and target locations. Source location is the top left and bottom right corners of the selection rectangle to be moved.\n
Target location is the top left corner of the target location on the spreadsheet.\n
`,
  },
  [AITool.DeleteCells]: {
    internalTool: false,
    description: `
Deletes the value(s) of a rectangular selection of cells, requires an array of rectangular selection of cells to delete.\n
You should use the DeleteCells function to delete the value(s) of a rectangular selection of cells.\n
This functions requires an array of rectangular selection of cells to delete. Each rectangular selection of cells is defined by its top left corner (x,y) and the width and height.\n
`,
    parameters: {
      type: 'object',
      properties: {
        rects: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              topLeftX: {
                type: 'number',
                description:
                  'The x position of the cell, which is the column index of the current spreadsheet. This is the column index of the top left corner of the rectangular selection of cells to delete',
              },
              topLeftY: {
                type: 'number',
                description:
                  'The y position of the cell, which is the row index of the current spreadsheet. This is the row index of the top left corner of the rectangular selection of cells to delete',
              },
              width: {
                type: 'number',
                description: 'The width of the rectangular selection of cells to delete',
              },
              height: {
                type: 'number',
                description: 'The height of the rectangular selection of cells to delete',
              },
            },
            required: ['topLeftX', 'topLeftY', 'width', 'height'],
            additionalProperties: false,
          },
        },
      },
      required: ['rects'],
      additionalProperties: false,
    },
    responseSchema: AIToolsArgsSchema[AITool.DeleteCells],
    action: async (args) => {
      const { rects } = args;
      if (!rects || rects.length === 0) {
        return `No cells to delete`;
      }

      const selection: Selection = {
        sheet_id: {
          id: sheets.current,
        },
        x: BigInt(rects[0].topLeftX),
        y: BigInt(rects[0].topLeftY),
        rects: rects.map((rect) => ({
          min: {
            x: BigInt(rect.topLeftX),
            y: BigInt(rect.topLeftY),
          },
          max: {
            x: BigInt(rect.topLeftX + rect.width - 1),
            y: BigInt(rect.topLeftY + rect.height - 1),
          },
        })),
        rows: null,
        columns: null,
        all: false,
      };
      quadraticCore.deleteCellValues(selection, sheets.getCursorPosition());
      return `Executed delete cells tool successfully.`;
    },
    prompt: `
You should use the DeleteCells function to delete the value(s) of a rectangular selection of cells.\n
This functions requires an array of rectangular selection of cells to delete. Each rectangular selection of cells is defined by its top left corner (x,y) and the width and height.\n
`,
  },
} as const;
