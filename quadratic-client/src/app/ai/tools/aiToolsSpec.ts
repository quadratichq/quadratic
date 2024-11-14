import { AITool } from '@/app/ai/tools/aiTools';
import { sheets } from '@/app/grid/controller/Sheets';
import { ensureRectVisible } from '@/app/gridGL/interaction/viewportHelper';
import { Selection, SheetRect } from '@/app/quadratic-core-types';
import { quadraticCore } from '@/app/web-workers/quadraticCore/quadraticCore';
import { AIToolArgs } from 'quadratic-shared/typesAndSchemasAI';
import { z } from 'zod';

type AIToolSpec<T extends keyof typeof AIToolsArgsSchema> = {
  internalTool: boolean; // tools meant to get structured data from AI, but not meant to be used during chat
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
  [AITool.SetAIResearcherValue]: z.object({
    cell_value: z.string(),
    source_urls: z.array(z.string()),
    confidence_score: z.number(),
  }),
  [AITool.SetChatName]: z.object({
    chat_name: z.string(),
  }),
  [AITool.SetCodeCellValue]: z.object({
    code_cell_language: z.enum(['Python', 'Javascript', 'Formula']),
    code_cell_x: z.number(),
    code_cell_y: z.number(),
    code_string: z.string(),
    output_width: z.number(),
    output_height: z.number(),
  }),
  [AITool.SetCellValues]: z.object({
    top_left_x: z.number(),
    top_left_y: z.number(),
    cell_values: z.array(z.array(z.string())),
  }),
  [AITool.MoveCells]: z.object({
    source_top_left_x: z.number(),
    source_top_left_y: z.number(),
    source_bottom_right_x: z.number(),
    source_bottom_right_y: z.number(),
    target_top_left_x: z.number(),
    target_top_left_y: z.number(),
  }),
  [AITool.DeleteCells]: z.object({
    rects: z.array(
      z.object({
        top_left_x: z.number(),
        top_left_y: z.number(),
        rect_width: z.number(),
        rect_height: z.number(),
      })
    ),
  }),
} as const;

export type AIToolSpecRecord = {
  [K in AITool]: AIToolSpec<K>;
};

export const aiToolsSpec: AIToolSpecRecord = {
  [AITool.SetAIResearcherValue]: {
    internalTool: true,
    description:
      "Sets the result of the AI Researcher as a value on the spreadsheet, based on user's query for some referenced cell value(s) from the spreadsheet.",
    parameters: {
      type: 'object',
      properties: {
        cell_value: {
          type: 'string',
          description:
            'The value result of the query to the AI Researcher, this will be directly inserted into the cell in the spreadsheet',
        },
        source_urls: {
          type: 'array',
          items: {
            type: 'string',
            description: 'The urls of the search results that were used to answer the query',
          },
        },
        confidence_score: {
          type: 'number',
          description: 'The average confidence score of the search results that were used to answer the query',
        },
      },
      required: ['cell_value', 'source_urls', 'confidence_score'],
      additionalProperties: false,
    },
    responseSchema: AIToolsArgsSchema[AITool.SetAIResearcherValue],
    action: async (args) => {
      // no action as this tool is only meant to get structured data from AI
      return `Executed set ai researcher value tool successfully with value: ${args.cell_value}`;
    },
    prompt: `
You should use the set_ai_researcher_value function to set the result of the AI Researcher as a value on the spreadsheet.\n
This value should be in strong correlation to the referenced cell value(s) from the spreadsheet and should directly answer the users query related to the referenced cell value(s).\n
This function requires the value that will be set on the spreadsheet. It can be a text, number, currency, date, etc.\n
You should also include the source_urls and confidence_score in the response, these are the urls of the search results that were used to answer the query and the confidence score of the search results.\n
`,
  },
  [AITool.SetChatName]: {
    internalTool: true,
    description: `
Set the name of the user chat with AI assistant, this is the name of the chat in the chat history\n
You should use the set_chat_name function to set the name of the user chat with AI assistant, this is the name of the chat in the chat history.\n
This function requires the name of the chat, this should be concise and descriptive of the conversation, and should be easily understandable by a non-technical user.\n
The chat name should be based on user's messages and should reflect his/her queries and goals.\n
This name should be from user's perspective, not the assistant's.\n
`,
    parameters: {
      type: 'object',
      properties: {
        chat_name: {
          type: 'string',
          description: 'The name of the chat',
        },
      },
      required: ['chat_name'],
      additionalProperties: false,
    },
    responseSchema: AIToolsArgsSchema[AITool.SetChatName],
    action: async (args) => {
      // no action as this tool is only meant to get structured data from AI
      return `Executed set chat name tool successfully with name: ${args.chat_name}`;
    },
    prompt: `
You can use the set_chat_name function to set the name of the user chat with AI assistant, this is the name of the chat in the chat history.\n
This function requires the name of the chat, this should be concise and descriptive of the conversation, and should be easily understandable by a non-technical user.\n
The chat name should be based on user's messages and should reflect his/her queries and goals.\n
This name should be from user's perspective, not the assistant's.\n
`,
  },
  [AITool.SetCellValues]: {
    internalTool: false,
    description: `
Sets the values of the currently open sheet cells to a 2d array of strings, requires the cell position (x, y) and the 2d array of strings.\n
Use set_cell_values function to add data to the currently open sheet. Don't use code cell for adding data. Always add data using this function.\n
Values are string representation of text, number, logical, time instant, duration, error, html, code, image, date, time or blank.\n
(x,y) is the position of the top left corner of the 2d array of values on the currently open sheet. Each sub array represents a row of values.\n
All values can be referenced in the code cells immediately. Always refer to the cell by its (x,y) position. Don't add values manually in code cells.\n
To clear the values of a cell, set the value to an empty string.\n
`,
    parameters: {
      type: 'object',
      properties: {
        top_left_x: {
          type: 'number',
          description:
            'The x position of the cell, which is the column index of the currently open sheet. This is the column index of the top left corner of the added 2d array of values on the currently open sheet',
        },
        top_left_y: {
          type: 'number',
          description:
            'The y position of the cell, which is the row index of the currently open sheet. This is the row index of the top left corner of the added 2d array of values on the currently open sheet',
        },
        cell_values: {
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
      required: ['top_left_x', 'top_left_y', 'cell_values'],
      additionalProperties: false,
    },
    responseSchema: AIToolsArgsSchema[AITool.SetCellValues],
    action: async (args) => {
      const { top_left_x, top_left_y, cell_values } = args;
      quadraticCore.setCellValues(sheets.current, top_left_x, top_left_y, cell_values, sheets.getCursorPosition());
      ensureRectVisible(
        { x: top_left_x, y: top_left_y },
        { x: top_left_x + cell_values[0].length - 1, y: top_left_y + cell_values.length - 1 }
      );
      return 'Executed set cell values tool successfully';
    },
    prompt: `
You should use the set_cell_values function to set the values of the currently open sheet cells to a 2d array of strings.\n
Use this function to add data to the currently open sheet. Don't use code cell for adding data. Always add data using this function.\n
This function requires the cell position (x, y) and the 2d array of strings. Values are string representation of text, number, logical, time instant, duration, error, html, code, image, date, time or blank.\n
Values set using this function will replace the existing values in the cell and can be referenced in the code cells immediately. Always refer to the cell by its (x,y) position. Don't add these in code cells.\n
To clear the values of a cell, set the value to an empty string.\n
`,
  },
  [AITool.SetCodeCellValue]: {
    internalTool: false,
    description: `
Sets the value of a code cell and run it in the currently open sheet, requires the cell position (x, y), codeString and language\n
You should use the set_code_cell_value function to set this code cell value. Use this function instead of responding with code.\n
Never use set_code_cell_value function to set the value of a cell to a value that is not a code. Don't add static data to the currently open sheet using set_code_cell_value function, use set_cell_values instead. set_code_cell_value function is only meant to set the value of a cell to a code.\n
Always refer to the cell by its (x,y) position from the respective sheet. Don't add values manually in code cells.\n
`,
    parameters: {
      type: 'object',
      properties: {
        code_cell_language: {
          type: 'string',
          description:
            'The language of the code cell, this can be one of Python, Javascript or Formula. This is case sensitive.',
        },
        code_cell_x: {
          type: 'number',
          description: 'The x position of the cell, which is the column index of the currently open spreadsheet',
        },
        code_cell_y: {
          type: 'number',
          description: 'The y position of the cell, which is the row index of the currently open spreadsheet',
        },
        code_string: {
          type: 'string',
          description: 'The code which will run in the cell',
        },
        output_width: {
          type: 'number',
          description:
            'The width, i.e. number of columns, of the code output on running this Code in the currently open spreadsheet',
        },
        output_height: {
          type: 'number',
          description:
            'The height, i.e. number of rows, of the code output on running this Code in the currently open spreadsheet',
        },
      },
      required: ['code_cell_language', 'code_cell_x', 'code_cell_y', 'code_string', 'output_width', 'output_height'],
      additionalProperties: false,
    },
    responseSchema: AIToolsArgsSchema[AITool.SetCodeCellValue],
    action: async (args) => {
      const { code_cell_language, code_string, code_cell_x, code_cell_y, output_width, output_height } = args;
      quadraticCore.setCodeCellValue({
        sheetId: sheets.current,
        x: code_cell_x,
        y: code_cell_y,
        codeString: code_string,
        language: code_cell_language,
        cursor: sheets.getCursorPosition(),
      });
      ensureRectVisible(
        { x: code_cell_x, y: code_cell_y },
        { x: code_cell_x + output_width - 1, y: code_cell_y + output_height - 1 }
      );
      return 'Executed set code cell value tool successfully';
    },
    prompt: `
You should use the set_code_cell_value function to set this code cell value. Use set_code_cell_value function instead of responding with code.\n
Never use set_code_cell_value function to set the value of a cell to a value that is not a code. Don't add data to the currently open sheet using set_code_cell_value function, use set_cell_values instead. set_code_cell_value function is only meant to set the value of a cell to a code.\n
set_code_cell_value function requires language, codeString, the cell position (x, y) and the width and height of the code output on running this Code in the currently open sheet.\n
Always refer to the cell by its (x,y) position from the respective sheet. Don't add values manually in code cells.\n
The required location (x,y) for this code cell is one which satisfies the following conditions:\n
 - The code cell location (x,y) should be empty and should have enough space to the right and below to accommodate the code result. If there is a value in a single cell where the code result is suppose to go, it will result in spill error. Use currently open sheet context to identify empty space.\n
 - The code cell should be near the data it references, so that it is easy to understand the code in the context of the data. Identify the data being referred from code and use a cell close to it. If multiple data references are being made, choose the one which is most used or most important. This will make it easy to understand the code in the context of the table.\n
 - If the referenced data is portrait in a table format, the code cell should be next to the top right corner of the table.\n
 - If the referenced data is landscape in a table format, the code cell should be below the bottom left corner of the table.\n
 - Always leave a blank row / column between the code cell and the data it references.\n
 - In case there is not enough empty space near the referenced data, choose a distant empty cell which is in the same row as the top right corner of referenced data and to the right of this data.\n
 - If there are multiple tables or data sources being referenced, place the code cell in a location that provides a good balance between proximity to all referenced data and maintaining readability of the currently open sheet.\n
 - Consider the overall layout and organization of the currently open sheet when placing the code cell, ensuring it doesn't disrupt existing data or interfere with other code cells.\n
 - A plot returned by the code cell occupies just one cell, the plot overlay is larger but the code cell is always just one cell.\n
 `,
  },
  [AITool.MoveCells]: {
    internalTool: false,
    description: `
Moves a rectangular selection of cells from one location to another on the currently open sheet, requires the source and target locations.\n
You should use the move_cells function to move a rectangular selection of cells from one location to another on the currently open sheet.\n
move_cells function requires the source and target locations. Source location is the top left and bottom right corners of the selection rectangle to be moved.\n
Target location is the top left corner of the target location on the currently open sheet.\n
`,
    parameters: {
      type: 'object',
      properties: {
        source_top_left_x: {
          type: 'number',
          description:
            'The x position of the cell, which is the column index of the currently open sheet. This is the column index of the top left corner of the rectangular selection of cells to move',
        },
        source_top_left_y: {
          type: 'number',
          description:
            'The y position of the cell, which is the row index of the currently open sheet. This is the row index of the top left corner of the rectangular selection of cells to move',
        },
        source_bottom_right_x: {
          type: 'number',
          description:
            'The x position of the cell, which is the column index of the currently open sheet. This is the column index of the bottom right corner of the rectangular selection of cells to move',
        },
        source_bottom_right_y: {
          type: 'number',
          description:
            'The y position of the cell, which is the row index of the currently open sheet. This is the row index of the bottom right corner of the rectangular selection of cells to move',
        },
        target_top_left_x: {
          type: 'number',
          description:
            'The x position of the cell, which is the column index of the currently open sheet. This is the column index of the top left corner of the target location on the currently open sheet',
        },
        target_top_left_y: {
          type: 'number',
          description:
            'The y position of the cell, which is the row index of the currently open sheet. This is the row index of the top left corner of the target location on the currently open sheet',
        },
      },
      required: [
        'source_top_left_x',
        'source_top_left_y',
        'source_bottom_right_x',
        'source_bottom_right_y',
        'target_top_left_x',
        'target_top_left_y',
      ],
      additionalProperties: false,
    },
    responseSchema: AIToolsArgsSchema[AITool.MoveCells],
    action: async (args) => {
      const {
        source_top_left_x,
        source_top_left_y,
        source_bottom_right_x,
        source_bottom_right_y,
        target_top_left_x,
        target_top_left_y,
      } = args;
      const sheetRect: SheetRect = {
        min: {
          x: BigInt(source_top_left_x),
          y: BigInt(source_top_left_y),
        },
        max: {
          x: BigInt(source_bottom_right_x),
          y: BigInt(source_bottom_right_y),
        },
        sheet_id: {
          id: sheets.current,
        },
      };
      quadraticCore.moveCells(sheetRect, target_top_left_x, target_top_left_y, sheets.current);
      return `Executed move cells tool successfully.`;
    },
    prompt: `
You should use the move_cells function to move a rectangular selection of cells from one location to another on the currently open sheet.\n
move_cells function requires the source and target locations. Source location is the top left and bottom right corners of the selection rectangle to be moved.\n
Target location is the top left corner of the target location on the currently open sheet.\n
`,
  },
  [AITool.DeleteCells]: {
    internalTool: false,
    description: `
Deletes the value(s) of a rectangular selection of cells, requires an array of rectangular selection of cells to delete.\n
You should use the delete_cells function to delete the value(s) of a rectangular selection of cells on the currently open sheet.\n
delete_cells functions requires an array of rectangular selection of cells to delete. Each rectangular selection of cells is defined by its top left corner (x,y) and the width and height.\n
`,
    parameters: {
      type: 'object',
      properties: {
        rects: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              top_left_x: {
                type: 'number',
                description:
                  'The x position of the cell, which is the column index of the currently open sheet. This is the column index of the top left corner of the rectangular selection of cells to delete',
              },
              top_left_y: {
                type: 'number',
                description:
                  'The y position of the cell, which is the row index of the currently open sheet. This is the row index of the top left corner of the rectangular selection of cells to delete',
              },
              rect_width: {
                type: 'number',
                description: 'The width of the rectangular selection of cells to delete',
              },
              rect_height: {
                type: 'number',
                description: 'The height of the rectangular selection of cells to delete',
              },
            },
            required: ['top_left_x', 'top_left_y', 'rect_width', 'rect_height'],
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
        x: BigInt(rects[0].top_left_x),
        y: BigInt(rects[0].top_left_y),
        rects: rects.map((rect) => ({
          min: {
            x: BigInt(rect.top_left_x),
            y: BigInt(rect.top_left_y),
          },
          max: {
            x: BigInt(rect.top_left_x + rect.rect_width - 1),
            y: BigInt(rect.top_left_y + rect.rect_height - 1),
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
You should use the delete_cells function to delete the value(s) of a rectangular selection of cells on the currently open sheet.\n
delete_cells functions requires an array of rectangular selection of cells to delete. Each rectangular selection of cells is defined by its top left corner (x,y) and the width and height.\n
`,
  },
} as const;
