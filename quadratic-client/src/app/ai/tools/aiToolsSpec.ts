import { AITool } from '@/app/ai/tools/aiTools';
import { sheets } from '@/app/grid/controller/Sheets';
import { ensureRectVisible } from '@/app/gridGL/interaction/viewportHelper';
import type { SheetRect } from '@/app/quadratic-core-types';
import { stringToSelection } from '@/app/quadratic-rust-client/quadratic_rust_client';
import { quadraticCore } from '@/app/web-workers/quadraticCore/quadraticCore';
import type { AIToolArgs } from 'quadratic-shared/typesAndSchemasAI';
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
  [AITool.SetChatName]: z.object({
    chat_name: z.string(),
  }),
  [AITool.SetCodeCellValue]: z.object({
    code_cell_language: z.enum(['Python', 'Javascript', 'Formula']),
    code_cell_position: z.string(),
    code_string: z.string(),
    output_width: z.number(),
    output_height: z.number(),
  }),
  [AITool.SetCellValues]: z.object({
    top_left_position: z.string(),
    cell_values: z.array(z.array(z.string())),
  }),
  [AITool.MoveCells]: z.object({
    source_selection_rect: z.string(),
    target_top_left_position: z.string(),
  }),
  [AITool.DeleteCells]: z.object({
    selection: z.string(),
  }),
} as const;

export type AIToolSpecRecord = {
  [K in AITool]: AIToolSpec<K>;
};

export const aiToolsSpec: AIToolSpecRecord = {
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
Sets the values of the currently open sheet cells to a 2d array of strings, requires the top left cell position (in a1 notation) and the 2d array of strings representing the cell values to set.\n
Use set_cell_values function to add data to the currently open sheet. Don't use code cell for adding data. Always add data using this function.\n
Values are string representation of text, number, logical, time instant, duration, error, html, code, image, date, time or blank.\n
top_left_position is the position of the top left corner of the 2d array of values on the currently open sheet, in a1 notation. This should be a single cell, not a range. Each sub array represents a row of values.\n
All values can be referenced in the code cells immediately. Always refer to the cell by its position on respective sheet, in a1 notation. Don't add values manually in code cells.\n
To clear the values of a cell, set the value to an empty string.\n
`,
    parameters: {
      type: 'object',
      properties: {
        top_left_position: {
          type: 'string',
          description:
            'The position of the top left cell, in a1 notation, in the currently open sheet. This is the top left corner of the added 2d array of values on the currently open sheet. This should be a single cell, not a range.',
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
      required: ['top_left_position', 'cell_values'],
      additionalProperties: false,
    },
    responseSchema: AIToolsArgsSchema[AITool.SetCellValues],
    action: async (args) => {
      const { top_left_position, cell_values } = args;
      try {
        const selection = stringToSelection(top_left_position, sheets.current, sheets.a1Context);
        if (!selection.isSingleSelection()) {
          return 'Invalid code cell position, this should be a single cell, not a range';
        }
        const { x, y } = selection.getCursor();

        quadraticCore.setCellValues(sheets.current, x, y, cell_values, sheets.getCursorPosition());
        ensureRectVisible({ x, y }, { x: x + cell_values[0].length - 1, y: y + cell_values.length - 1 });

        return 'Executed set cell values tool successfully';
      } catch (e) {
        return `Error executing set cell values tool: ${e}`;
      }
    },
    prompt: `
You should use the set_cell_values function to set the values of the currently open sheet cells to a 2d array of strings.\n
Use this function to add data to the currently open sheet. Don't use code cell for adding data. Always add data using this function.\n
This function requires the top left cell position (in a1 notation) and the 2d array of strings representing the cell values to set. Values are string representation of text, number, logical, time instant, duration, error, html, code, image, date, time or blank.\n
Values set using this function will replace the existing values in the cell and can be referenced in the code cells immediately. Always refer to the cell by its position on respective sheet, in a1 notation. Don't add these in code cells.\n
To clear the values of a cell, set the value to an empty string.\n
`,
  },
  [AITool.SetCodeCellValue]: {
    internalTool: false,
    description: `
Sets the value of a code cell and run it in the currently open sheet, requires the cell position (in a1 notation), codeString and language\n
You should use the set_code_cell_value function to set this code cell value. Use this function instead of responding with code.\n
Never use set_code_cell_value function to set the value of a cell to a value that is not a code. Don't add static data to the currently open sheet using set_code_cell_value function, use set_cell_values instead. set_code_cell_value function is only meant to set the value of a cell to a code.\n
Always refer to the data from cell by its position in a1 notation from respective sheet. Don't add values manually in code cells.\n
`,
    parameters: {
      type: 'object',
      properties: {
        code_cell_language: {
          type: 'string',
          description:
            'The language of the code cell, this can be one of Python, Javascript or Formula. This is case sensitive.',
        },
        code_cell_position: {
          type: 'string',
          description:
            'The position of the code cell in the currently open sheet, in a1 notation. This should be a single cell, not a range.',
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
      required: ['code_cell_language', 'code_cell_position', 'code_string', 'output_width', 'output_height'],
      additionalProperties: false,
    },
    responseSchema: AIToolsArgsSchema[AITool.SetCodeCellValue],
    action: async (args) => {
      let { code_cell_language, code_string, code_cell_position, output_width, output_height } = args;
      try {
        const selection = stringToSelection(code_cell_position, sheets.current, sheets.a1Context);
        if (!selection.isSingleSelection()) {
          return 'Invalid code cell position, this should be a single cell, not a range';
        }
        const { x, y } = selection.getCursor();

        if (code_cell_language === 'Formula' && code_string.startsWith('=')) {
          code_string = code_string.slice(1);
        }

        quadraticCore.setCodeCellValue({
          sheetId: sheets.current,
          x,
          y,
          codeString: code_string,
          language: code_cell_language,
          cursor: sheets.getCursorPosition(),
        });
        ensureRectVisible({ x, y }, { x: x + output_width - 1, y: y + output_height - 1 });

        return 'Executed set code cell value tool successfully';
      } catch (e) {
        return `Error executing set code cell value tool: ${e}`;
      }
    },
    prompt: `
You should use the set_code_cell_value function to set this code cell value. Use set_code_cell_value function instead of responding with code.\n
Never use set_code_cell_value function to set the value of a cell to a value that is not a code. Don't add data to the currently open sheet using set_code_cell_value function, use set_cell_values instead. set_code_cell_value function is only meant to set the value of a cell to a code.\n
set_code_cell_value function requires language, codeString, the cell position (single cell in a1 notation) and the width and height of the code output on running this Code in the currently open sheet.\n
Always refer to the cells on sheet by its position in a1 notation, using q.cells function. Don't add values manually in code cells.\n
The required location code_cell_position for this code cell is one which satisfies the following conditions:\n
 - The code cell location should be empty and should have enough space to the right and below to accommodate the code result. If there is a value in a single cell where the code result is suppose to go, it will result in spill error. Use currently open sheet context to identify empty space.\n
 - The code cell should be near the data it references, so that it is easy to understand the code in the context of the data. Identify the data being referred from code and use a cell close to it. If multiple data references are being made, choose the one which is most used or most important. This will make it easy to understand the code in the context of the table.\n
 - If the referenced data is portrait in a table format, the code cell should be next to the top right corner of the table.\n
 - If the referenced data is landscape in a table format, the code cell should be below the bottom left corner of the table.\n
 - Always leave a blank row / column between the code cell and the data it references.\n
 - In case there is not enough empty space near the referenced data, choose a distant empty cell which is in the same row as the top right corner of referenced data and to the right of this data.\n
 - If there are multiple tables or data sources being referenced, place the code cell in a location that provides a good balance between proximity to all referenced data and maintaining readability of the currently open sheet.\n
 - Consider the overall layout and organization of the currently open sheet when placing the code cell, ensuring it doesn't disrupt existing data or interfere with other code cells.\n
 - A plot returned by the code cell occupies just one cell, the plot overlay is larger but the code cell is always just one cell.\n
 - Do not use conditional returns in python code cells.\n
 - Don't prefix formulas with \`=\` in code cells.\n
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
        source_selection_rect: {
          type: 'string',
          description:
            'The selection of cells, in a1 notation, to be moved in the currently open sheet. This is string representation of the rectangular selection of cells to be moved',
        },
        target_top_left_position: {
          type: 'string',
          description:
            'The top left position of the target location on the currently open sheet, in a1 notation. This should be a single cell, not a range. This will be the top left corner of the source selection rectangle after moving.',
        },
      },
      required: ['source_selection_rect', 'target_top_left_position'],
      additionalProperties: false,
    },
    responseSchema: AIToolsArgsSchema[AITool.MoveCells],
    action: async (args) => {
      const { source_selection_rect, target_top_left_position } = args;
      try {
        const sourceSelection = stringToSelection(source_selection_rect, sheets.current, sheets.a1Context);
        const sourceRect = sourceSelection.getSingleRectangleOrCursor(sheets.a1Context);
        if (!sourceRect) {
          return 'Invalid source selection, this should be a single rectangle, not a range';
        }
        const sheetRect: SheetRect = {
          min: {
            x: sourceRect.min.x,
            y: sourceRect.min.y,
          },
          max: {
            x: sourceRect.max.x,
            y: sourceRect.max.y,
          },
          sheet_id: {
            id: sheets.current,
          },
        };

        const targetSelection = stringToSelection(target_top_left_position, sheets.current, sheets.a1Context);
        if (!targetSelection.isSingleSelection()) {
          return 'Invalid code cell position, this should be a single cell, not a range';
        }
        const { x, y } = targetSelection.getCursor();

        quadraticCore.moveCells(sheetRect, x, y, sheets.current);

        return `Executed move cells tool successfully.`;
      } catch (e) {
        return `Error executing move cells tool: ${e}`;
      }
    },
    prompt: `
You should use the move_cells function to move a rectangular selection of cells from one location to another on the currently open sheet.\n
move_cells function requires the source selection and target position. Source selection is the string representation (in a1 notation) of a selection rectangle to be moved.\n
Target position is the top left corner of the target position on the currently open sheet, in a1 notation. This should be a single cell, not a range.\n
`,
  },
  [AITool.DeleteCells]: {
    internalTool: false,
    description: `
Deletes the value(s) of a selection of cells, requires a string representation of a selection of cells to delete. Selection can be a single cell or a range of cells or multiple ranges in a1 notation.\n
You should use the delete_cells function to delete the value(s) of a selection of cells on the currently open sheet.\n
delete_cells functions requires a string representation (in a1 notation) of a selection of cells to delete. Selection can be a single cell or a range of cells or multiple ranges in a1 notation.\n
`,
    parameters: {
      type: 'object',
      properties: {
        selection: {
          type: 'string',
          description:
            'The string representation (in a1 notation) of the selection of cells to delete, this can be a single cell or a range of cells or multiple ranges in a1 notation',
        },
      },
      required: ['selection'],
      additionalProperties: false,
    },
    responseSchema: AIToolsArgsSchema[AITool.DeleteCells],
    action: async (args) => {
      const { selection } = args;
      try {
        const sourceSelection = stringToSelection(selection, sheets.current, sheets.a1Context);

        quadraticCore.deleteCellValues(sourceSelection.save(), sheets.getCursorPosition());

        return `Executed delete cells tool successfully.`;
      } catch (e) {
        return `Error executing delete cells tool: ${e}`;
      }
    },
    prompt: `
You should use the delete_cells function to delete value(s) on the currently open sheet.\n
delete_cells functions requires a string representation (in a1 notation) of a selection of cells to delete. Selection can be a single cell or a range of cells or multiple ranges in a1 notation.\n
`,
  },
} as const;
