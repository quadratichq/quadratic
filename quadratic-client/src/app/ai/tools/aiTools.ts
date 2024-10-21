import { sheets } from '@/app/grid/controller/Sheets';
import { ensureRectVisible } from '@/app/gridGL/interaction/viewportHelper';
import { quadraticCore } from '@/app/web-workers/quadraticCore/quadraticCore';
import { z } from 'zod';

export enum AITool {
  SetCodeCellValue = 'SetCodeCellValue',
}

export type AIToolSpec<T extends AITool> = {
  description: string;
  parameters: {
    type: 'object';
    properties: Record<string, { type: string; description: string }>;
    required: string[];
  };
  responseSchema: (typeof AIToolsResponseSchema)[T];
  action: (args: z.infer<(typeof AIToolsResponseSchema)[T]>) => Promise<void>;
  prompt: string;
};

export const AIToolsResponseSchema = {
  [AITool.SetCodeCellValue]: z.object({
    language: z.enum(['Python', 'Javascript', 'Formula']),
    codeString: z.string(),
    x: z.number(),
    y: z.number(),
    width: z.number(),
    height: z.number(),
  }),
};

export const AI_TOOLS: Record<AITool, AIToolSpec<AITool>> = {
  [AITool.SetCodeCellValue]: {
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
      required: ['language', 'codeString', 'x', 'y', 'width', 'height'],
    },
    responseSchema: AIToolsResponseSchema[AITool.SetCodeCellValue],
    action: async (args: z.infer<(typeof AIToolsResponseSchema)[AITool.SetCodeCellValue]>) => {
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
};
