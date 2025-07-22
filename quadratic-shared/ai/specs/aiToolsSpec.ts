import type { AIModelKey } from 'quadratic-shared/typesAndSchemasAI';
import { type AISource, type AIToolArgs } from 'quadratic-shared/typesAndSchemasAI';
import { z } from 'zod';

export enum AITool {
  SetAIModel = 'set_ai_model',
  SetChatName = 'set_chat_name',
  AddDataTable = 'add_data_table',
  SetCellValues = 'set_cell_values',
  SetCodeCellValue = 'set_code_cell_value',
  SetFormulaCellValue = 'set_formula_cell_value',
  MoveCells = 'move_cells',
  DeleteCells = 'delete_cells',
  UpdateCodeCell = 'update_code_cell',
  CodeEditorCompletions = 'code_editor_completions',
  UserPromptSuggestions = 'user_prompt_suggestions',
  PDFImport = 'pdf_import',
  GetCellData = 'get_cell_data',
  HasCellData = 'has_cell_data',
  SetTextFormats = 'set_text_formats',
  GetTextFormats = 'get_text_formats',
  ConvertToTable = 'convert_to_table',
  WebSearch = 'web_search',
  WebSearchInternal = 'web_search_internal',

  AddSheet = 'add_sheet',
  DuplicateSheet = 'duplicate_sheet',
  RenameSheet = 'rename_sheet',
  DeleteSheet = 'delete_sheet',
  MoveSheet = 'move_sheet',
  ColorSheets = 'color_sheets',

  TextSearch = 'text_search',
  RerunCode = 'rerun_code',

  ResizeColumns = 'resize_columns',
  ResizeRows = 'resize_rows',

  SetBorders = 'set_borders',
}

export const AIToolSchema = z.enum([
  AITool.SetAIModel,
  AITool.SetChatName,
  AITool.AddDataTable,
  AITool.SetCellValues,
  AITool.SetCodeCellValue,
  AITool.SetFormulaCellValue,
  AITool.MoveCells,
  AITool.DeleteCells,
  AITool.UpdateCodeCell,
  AITool.CodeEditorCompletions,
  AITool.UserPromptSuggestions,
  AITool.PDFImport,
  AITool.GetCellData,
  AITool.HasCellData,
  AITool.SetTextFormats,
  AITool.GetTextFormats,
  AITool.ConvertToTable,
  AITool.WebSearch,
  AITool.WebSearchInternal,
  AITool.AddSheet,
  AITool.DuplicateSheet,
  AITool.RenameSheet,
  AITool.DeleteSheet,
  AITool.MoveSheet,
  AITool.ColorSheets,
  AITool.TextSearch,
  AITool.RerunCode,
  AITool.ResizeColumns,
  AITool.ResizeRows,
  AITool.SetBorders,
]);

type AIToolSpec<T extends keyof typeof AIToolsArgsSchema> = {
  sources: AISource[];
  description: string; // this is sent with tool definition, has a maximum character limit
  parameters: {
    type: 'object';
    properties: Record<string, AIToolArgs>;
    required: string[];
    additionalProperties: boolean;
  };
  responseSchema: (typeof AIToolsArgsSchema)[T];
  prompt: string; // this is sent as internal message to AI, no character limit
};

const array2DSchema = z
  .array(
    z.array(
      z.union([
        z.string(),
        z.number().transform(String),
        z.undefined().transform(() => ''),
        z.null().transform(() => ''),
      ])
    )
  )
  .or(
    z.string().transform((str) => {
      try {
        const parsed = JSON.parse(str);
        if (Array.isArray(parsed)) {
          return parsed.map((row) => {
            if (!Array.isArray(row)) {
              throw new Error('Invalid 2D array format - each row must be an array');
            }
            return row.map(String);
          });
        }
        throw new Error('Invalid 2D array format');
      } catch {
        throw new Error('Invalid 2D array format');
      }
    })
  )
  .transform((array) => {
    const maxColumns = array.length > 0 ? Math.max(...array.map((row) => row.length)) : 0;
    return array.map((row) => (row.length === maxColumns ? row : row.concat(Array(maxColumns - row.length).fill(''))));
  });

const cellLanguageSchema = z
  .string()
  .transform((val) => val.toLowerCase())
  .pipe(z.enum(['python', 'javascript']))
  .transform((val) => val.charAt(0).toUpperCase() + val.slice(1))
  .pipe(z.enum(['Python', 'Javascript']));

const modelRouterModels = z
  .string()
  .transform((val) => val.toLowerCase().replace(/\s+/g, '-'))
  .pipe(z.enum(['claude', '4.1']));

export const AIToolsArgsSchema = {
  [AITool.SetAIModel]: z.object({
    ai_model: modelRouterModels,
  }),
  [AITool.SetChatName]: z.object({
    chat_name: z.string(),
  }),
  [AITool.AddDataTable]: z.object({
    sheet_name: z.string(),
    top_left_position: z.string(),
    table_name: z.string(),
    table_data: array2DSchema,
  }),
  [AITool.SetCodeCellValue]: z.object({
    sheet_name: z.string().optional(),
    code_cell_name: z.string().optional(),
    code_cell_language: cellLanguageSchema,
    code_cell_position: z.string(),
    code_string: z.string(),
  }),
  [AITool.SetFormulaCellValue]: z.object({
    sheet_name: z.string().optional(),
    code_cell_position: z.string(),
    formula_string: z.string(),
  }),
  [AITool.SetCellValues]: z.object({
    sheet_name: z.string().optional(),
    top_left_position: z.string(),
    cell_values: array2DSchema,
  }),
  [AITool.MoveCells]: z.object({
    sheet_name: z.string().optional(),
    source_selection_rect: z.string(),
    target_top_left_position: z.string(),
  }),
  [AITool.DeleteCells]: z.object({
    sheet_name: z.string().optional(),
    selection: z.string(),
  }),
  [AITool.UpdateCodeCell]: z.object({
    code_string: z.string(),
  }),
  [AITool.CodeEditorCompletions]: z.object({
    text_delta_at_cursor: z.string(),
  }),
  [AITool.UserPromptSuggestions]: z.object({
    prompt_suggestions: z.array(
      z.object({
        label: z.string(),
        prompt: z.string(),
      })
    ),
  }),
  [AITool.PDFImport]: z.object({
    file_name: z.string(),
    prompt: z.string(),
  }),
  [AITool.GetCellData]: z.object({
    sheet_name: z.string().optional(),
    selection: z.string(),
    page: z.number(),
  }),
  [AITool.HasCellData]: z.object({
    sheet_name: z.string().optional(),
    selection: z.string(),
  }),
  [AITool.SetTextFormats]: z.object({
    sheet_name: z.string().optional(),
    selection: z.string(),
    bold: z.boolean().optional(),
    italic: z.boolean().optional(),
    underline: z.boolean().optional(),
    strike_through: z.boolean().optional(),
    text_color: z.string().optional(),
    fill_color: z.string().optional(),
    align: z.string().optional(),
    vertical_align: z.string().optional(),
    wrap: z.string().optional(),
    numeric_commas: z.boolean().optional(),
    number_type: z.string().optional(),
    currency_symbol: z.string().optional(),
    date_time: z.string().optional(),
  }),
  [AITool.GetTextFormats]: z.object({
    sheet_name: z.string().optional(),
    selection: z.string(),
    page: z.number(),
  }),
  [AITool.ConvertToTable]: z.object({
    sheet_name: z.string().optional(),
    selection: z.string(),
    table_name: z.string(),
    first_row_is_column_names: z.boolean(),
  }),
  [AITool.WebSearch]: z.object({
    query: z.string(),
  }),
  [AITool.WebSearchInternal]: z.object({
    query: z.string(),
  }),
  [AITool.AddSheet]: z.object({
    sheet_name: z.string(),
    insert_before_sheet_name: z.string().optional(),
  }),
  [AITool.DuplicateSheet]: z.object({
    sheet_name_to_duplicate: z.string(),
    name_of_new_sheet: z.string(),
  }),
  [AITool.RenameSheet]: z.object({
    sheet_name: z.string(),
    new_name: z.string(),
  }),
  [AITool.DeleteSheet]: z.object({
    sheet_name: z.string(),
  }),
  [AITool.MoveSheet]: z.object({
    sheet_name: z.string(),
    insert_before_sheet_name: z.string().optional(),
  }),
  [AITool.ColorSheets]: z.object({
    sheet_name_to_color: z.record(z.string(), z.string()),
  }),
  [AITool.TextSearch]: z.object({
    query: z.string(),
    case_sensitive: z.boolean(),
    whole_cell: z.boolean(),
    search_code: z.boolean(),
    sheet_name: z.string().optional(),
  }),
  [AITool.RerunCode]: z.object({
    sheet_name: z.string().optional(),
    selection: z.string().optional(),
  }),
  [AITool.ResizeColumns]: z.object({
    sheet_name: z.string().optional(),
    selection: z.string(),
    size: z.enum(['auto', 'default']),
  }),
  [AITool.ResizeRows]: z.object({
    sheet_name: z.string().optional(),
    selection: z.string(),
    size: z.enum(['auto', 'default']),
  }),
  [AITool.SetBorders]: z.object({
    sheet_name: z.string().optional(),
    selection: z.string(),
    color: z.string(),
    line: z.enum(['Line1', 'Line2', 'Line3', 'Dotted', 'Dashed', 'Double', 'Clear']),
    border_selection: z.enum([
      'All',
      'Inner',
      'Outer',
      'Horizontal',
      'Vertical',
      'Left',
      'Top',
      'Right',
      'Bottom',
      'Clear',
    ]),
  }),
} as const;

export type AIToolSpecRecord = {
  [K in AITool]: AIToolSpec<K>;
};

export const MODELS_ROUTER_CONFIGURATION: {
  [key in z.infer<(typeof AIToolsArgsSchema)[AITool.SetAIModel]>['ai_model']]: AIModelKey;
} = {
  claude: 'vertexai-anthropic:claude-sonnet-4:thinking-toggle-off',
  '4.1': 'azure-openai:gpt-4.1',
};

export const aiToolsSpec: AIToolSpecRecord = {
  [AITool.SetAIModel]: {
    sources: ['ModelRouter'],
    description: `
Sets the AI Model to use for this user prompt.\n
Choose the AI model for this user prompt based on the following instructions, always respond with only one the model options matching it exactly.\n
`,
    parameters: {
      type: 'object',
      properties: {
        ai_model: {
          type: 'string',
          description:
            'Value can be only one of the following: "claude" or "4.1" models exactly, this is the model best suited for the user prompt based on examples and model capabilities.\n',
        },
      },
      required: ['ai_model'],
      additionalProperties: false,
    },
    responseSchema: AIToolsArgsSchema[AITool.SetAIModel],
    prompt: '',
  },
  [AITool.SetChatName]: {
    sources: ['GetChatName'],
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
    prompt: '',
  },
  [AITool.GetCellData]: {
    sources: ['AIAnalyst'],
    description: `
This tool returns the values of the cells in the chosen selection. The selection may be in the sheet or in a data table.\n
Do NOT use this tool if there is no data based on the data bounds provided for the sheet, or if you already have the data in context.\n
You should use the get_cell_data function to get the values of the cells when you need more data for a successful reference.\n
Include the sheet name in both the selection and the sheet_name parameter. Use the current sheet name in the context unless the user is requesting data from another sheet, in which case use that sheet name.\n
get_cell_data function requires a string representation (in a1 notation) of a selection of cells to get the values of (e.g., "A1:B10", "TableName[Column 1]", or "Sheet2!D:D"), and the name of the current sheet.\n
The get_cell_data function may return page information. Use the page parameter to get the next page of results.\n
IMPORTANT: If the results include page information:\n
- if the tool tells you it has too many pages, then you MUST try to find another way to deal with the request (unless the user is requesting this approach).\n
- you MUST perform actions on the current page's results before requesting the next page of results.\n
- as you get each page, IMMEDIATELY perform any actions before moving to the next page because the data for that page will be removed from the following AI call.\n
`,
    parameters: {
      type: 'object',
      properties: {
        sheet_name: {
          type: 'string',
          description:
            'The sheet name of the current sheet as defined in the context, unless the user is requesting data from another sheet. In which case, use that sheet name.',
        },
        selection: {
          type: 'string',
          description: `
The string representation (in a1 notation) of the selection of cells to get the values of. If the user is requesting data from another sheet, use that sheet name in the selection (e.g., "Sheet 2!A1")`,
        },
        page: {
          type: 'number',
          description:
            'The page number of the results to return. The first page is always 0. Use the parameters with a different page to get the next set of results.',
        },
      },
      required: ['selection', 'sheet_name', 'page'],
      additionalProperties: false,
    },
    responseSchema: AIToolsArgsSchema[AITool.GetCellData],
    prompt: `
This tool returns a list of cells and their values in the chosen selection. It ignores all empty cells.\n
Do NOT use this tool if there is no data based on the data bounds provided for the sheet, or if you already have the data in context.\n
You SHOULD use the get_cell_data function to get the values of the cells when you need more data to reference for your response.\n
You SHOULD use the get_cell_data function rather than assuming patterns; if you're not perfectly confident with the data already provided, check the data on the sheet first.\n
This tool does NOT return formatting information (like bold, currency, etc.). Use get_text_formats function for cell formatting information.\n
IMPORTANT: If the results include page information:\n
- if the tool tells you it has too many pages, then you MUST try to find another way to deal with the request (unless the user is requesting this approach).\n
- you MUST perform actions on the current page's results before requesting the next page of results.\n
- as you get each page, IMMEDIATELY perform any actions before moving to the next page because the data for that page will be removed from the following AI call.\n
`,
  },
  [AITool.HasCellData]: {
    sources: ['AIAnalyst'],
    description: `
This tool checks if the cells in the chosen selection have any data. This tool is useful to use before moving tables or cells to avoid moving cells over existing data.\n
`,
    parameters: {
      type: 'object',
      properties: {
        sheet_name: {
          type: 'string',
          description:
            'The sheet name of the current sheet as defined in the context, unless the user is requesting data from another sheet. In which case, use that sheet name.',
        },
        selection: {
          type: 'string',
          description: `
The string representation (in a1 notation) of the selection of cells to check for data. If the user is requesting data from another sheet, use that sheet name in the selection (e.g., "Sheet 2!A1")`,
        },
      },
      required: ['selection', 'sheet_name'],
      additionalProperties: false,
    },
    responseSchema: AIToolsArgsSchema[AITool.HasCellData],
    prompt: `This tool checks if the cells in the chosen selection have any data. This tool is useful to use before moving tables or cells to avoid moving cells over existing data.\n`,
  },
  [AITool.AddDataTable]: {
    sources: ['AIAnalyst', 'PDFImport'],
    description: `
Adds a data table to the sheet with sheet_name, requires the sheet name, top left cell position (in a1 notation), the name of the data table and the data to add. The data should be a 2d array of strings, where each sub array represents a row of values.\n
Do NOT use this tool if you want to convert existing data to a data table. Use convert_to_table instead.\n
The first row of the data table is considered to be the header row, and the data table will be created with the first row as the header row.\n
All rows in the 2d array of values should be of the same length. Use empty strings for missing values but always use the same number of columns for each row.\n
Data tables are best for adding new tabular data to the sheet.\n\n
Don't use this tool to add data to an existing data table. Use set_cell_values function to add data to an existing data table.\n
`,
    parameters: {
      type: 'object',
      properties: {
        sheet_name: {
          type: 'string',
          description: 'The sheet name of the current sheet as defined in the context',
        },
        top_left_position: {
          type: 'string',
          description:
            'The top left position of the data table on the current open sheet, in a1 notation. This should be a single cell, not a range.',
        },
        table_name: {
          type: 'string',
          description:
            "The name of the data table to add to the current open sheet. This should be a concise and descriptive name of the data table. Don't use special characters or spaces in the name. Always use a unique name for the data table. Spaces, if any, in name are replaced with underscores.",
        },
        table_data: {
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
      required: ['sheet_name', 'top_left_position', 'table_name', 'table_data'],
      additionalProperties: false,
    },
    responseSchema: AIToolsArgsSchema[AITool.AddDataTable],
    prompt: `
Adds a data table to the current sheet defined in the context, requires the sheet name, top_left_position (in a1 notation), the name of the data table and the data to add. The data should be a 2d array of strings, where each sub array represents a row of values.\n
top_left_position is the anchor position of the data table.\n
Do NOT use this tool if you want to convert existing data to a data table. Use convert_to_table instead.\n
The first row of the data table is considered to be the header row, and the data table will be created with the first row as the header row.\n
The added table on the sheet contains an extra row with the name of the data table. Always leave 2 rows of extra space on the bottom and 2 columns of extra space on the right when adding data tables on the sheet.\n
All rows in the 2d array of values should be of the same length. Use empty strings for missing values but always use the same number of columns for each row.\n
Data tables are best for adding new tabular data to the sheet.\n
Don't use this tool to add data to a data table that already exists. Use set_cell_values function to add data to a data table that already exists.\n
All values can be referenced in the code cells immediately. Always refer to the cell by its position on respective sheet, in a1 notation. Don't add values manually in code cells.\n
To delete a data table, use set_cell_values function with the top_left_position of the data table and with just one empty string value at the top_left_position. Overwriting the top_left_position (anchor position) deletes the data table.\n
Don't attempt to add formulas or code to data tables.\n`,
  },
  [AITool.SetCellValues]: {
    sources: ['AIAnalyst'],
    description: `
Sets the values of the current open sheet cells to a 2d array of strings, requires the top_left_position (in a1 notation) and the 2d array of strings representing the cell values to set.\n
Use set_cell_values function to add data to the current open sheet. Don't use code cell for adding data. Always add data using this function.\n\n
Values are string representation of text, number, logical, time instant, duration, error, html, code, image, date, time or blank.\n
top_left_position is the position of the top left corner of the 2d array of values on the current open sheet, in a1 notation. This should be a single cell, not a range. Each sub array represents a row of values.\n
All values can be referenced in the code cells immediately. Always refer to the cell by its position on respective sheet, in a1 notation. Don't add values manually in code cells.\n
To clear the values of a cell, set the value to an empty string.\n
Don't use this tool for adding formulas or code. Use set_code_cell_value function for Python/Javascript code or set_formula_cell_value function for formulas.\n
`,
    parameters: {
      type: 'object',
      properties: {
        sheet_name: {
          type: 'string',
          description: 'The sheet name of the current sheet as defined in the context',
        },
        top_left_position: {
          type: 'string',
          description:
            'The position of the top left cell, in a1 notation, in the current open sheet. This is the top left corner of the added 2d array of values on the current open sheet. This should be a single cell, not a range.',
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
      required: ['sheet_name', 'top_left_position', 'cell_values'],
      additionalProperties: false,
    },
    responseSchema: AIToolsArgsSchema[AITool.SetCellValues],
    prompt: `
You should use the set_cell_values function to set the values of a sheet to a 2d array of strings.\n
Use this function to add data to a sheet. Don't use code cell for adding data. Always add data using this function.\n\n
CRITICALLY IMPORTANT: you MUST insert column headers ABOVE the first row of data.\n
When setting cell values, follow these rules for headers:\n
1. The header row MUST be the first row in the cell_values array\n
2. The header row MUST contain column names that describe the data below\n
3. The header row MUST have the same number of columns as the data rows\n
4. The header row MUST be included in the cell_values array, not as a separate operation\n
5. The top_left_position MUST point to where the header row should start, which is usually the row above the first row of inserted data\n\n
This function requires the sheet name of the current sheet from the context, the top_left_position (in a1 notation) and the 2d array of strings representing the cell values to set. Values are string representation of text, number, logical, time instant, duration, error, html, code, image, date, time or blank.\n
Values set using this function will replace the existing values in the cell and can be referenced in the code cells immediately. Always refer to the cell by its position on respective sheet, in a1 notation. Don't add these in code cells.\n
To clear the values of a cell, set the value to an empty string.\n
Don't use this tool for adding formulas or code. Use set_code_cell_value function for Python/Javascript code or set_formula_cell_value function for formulas.\n
`,
  },
  [AITool.SetCodeCellValue]: {
    sources: ['AIAnalyst'],
    description: `
Sets the value of a code cell and runs it in the current open sheet, requires the language (Python or Javascript), cell position (in a1 notation), and code string.\n
Default output size of a new plot/chart is 7 wide * 23 tall cells.\n
You should use the set_code_cell_value function to set code cell values; use set_code_cell_value function instead of responding with code.\n
Never use set_code_cell_value function to set the value of a cell to a value that is not code. Don't add static data to the current open sheet using set_code_cell_value function, use set_cell_values instead. set_code_cell_value function is only meant to set the value of a cell to code.\n
Provide a name for the output of the code cell. The name cannot contain spaces or special characters (but _ is allowed).\n
Note: only name the code cell if it is new.\n
Always refer to the data from cell by its position in a1 notation from respective sheet.\n
Do not attempt to add code to data tables, it will result in an error.\n
This tool is for Python and Javascript code only. For formulas, use set_formula_cell_value.\n
`,
    parameters: {
      type: 'object',
      properties: {
        sheet_name: {
          type: 'string',
          description: 'The sheet name of the current sheet as defined in the context',
        },
        code_cell_name: {
          type: 'string',
          description:
            'What to name the output of the code cell. The name cannot contain spaces or special characters (but _ is allowed). First letter capitalized is preferred.',
        },
        code_cell_language: {
          type: 'string',
          description:
            'The language of the code cell, this can be one of Python or Javascript. This is case sensitive.',
        },
        code_cell_position: {
          type: 'string',
          description:
            'The position of the code cell in the current open sheet, in a1 notation. This should be a single cell, not a range.',
        },
        code_string: {
          type: 'string',
          description: 'The code which will run in the cell',
        },
      },
      required: ['sheet_name', 'code_cell_name', 'code_cell_language', 'code_cell_position', 'code_string'],
      additionalProperties: false,
    },
    responseSchema: AIToolsArgsSchema[AITool.SetCodeCellValue],
    prompt: `
You should use the set_code_cell_value function to set this code cell value. Use set_code_cell_value instead of responding with code.\n
Set code cell value tool should be used for relatively complex tasks. Tasks like data transformations, correlations, machine learning, slicing, etc. For more simple tasks, use set_formula_cell_value.\n
Never use set_code_cell_value function to set the value of a cell to a value that is not code. Don't add data to the current open sheet using set_code_cell_value function, use set_cell_values instead. set_code_cell_value function is only meant to set the value of a cell to code.\n
set_code_cell_value function requires language, codeString, and the cell position (single cell in a1 notation).\n
Always refer to the cells on sheet by its position in a1 notation, using q.cells function. Don't add values manually in code cells.\n
This tool is for Python and Javascript code only. For formulas, use set_formula_cell_value.\n

Code cell (Python and Javascript) placement instructions:\n
- The code cell location should be empty and positioned such that it will not overlap other cells. If there is a value in a single cell where the code result is supposed to go, it will result in spill error. Use current open sheet context to identify empty space.\n
- The code cell should be near the data it references, so that it is easy to understand the code in the context of the data. Identify the data being referred from code and use a cell close to it. If multiple data references are being made, choose the one which is most used or most important. This will make it easy to understand the code in the context of the table.\n
- If the referenced data is portrait (more rows than columns, e.g. A1:C15), the code cell should be next to the top right corner of the table. In the example where the table is A1:C15, this would mean placing the code in row 1.\n
- If the referenced data is landscape (more columns than rows, e.g. A1:H3), the code cell should be below the bottom left corner of the table. In the A1:H3 example, this would mean placing the code cell in column A.\n
- Leave exactly one blank row / column between the code cell and the data it references. Example: if top right corner of referenced data is at D1, the code cell should be placed at F1, which leaves one column of space. If placing underneath data e.g. A3:D19, you'd place in A21.\n
- In case there is not enough empty space near the referenced data, choose a distant empty cell which is in the same row as the top right corner of referenced data and to the right of this data.\n
- If there are multiple tables or data sources being referenced, place the code cell in a location that provides a good balance between proximity to all referenced data and maintaining readability of the current open sheet.\n
- Consider the overall layout and organization of the current open sheet when placing the code cell, ensuring it doesn't disrupt existing data or interfere with other code cells.\n
- A plot returned by the code cell occupies space on the sheet and spills if there is any data present in the sheet where the plot is suppose to take place. Default output size of a new plot is 7 wide * 23 tall cells.\n
`,
  },
  [AITool.SetFormulaCellValue]: {
    sources: ['AIAnalyst'],
    description: `
Sets the value of a formula cell and runs it in the current open sheet, requires the cell position (in a1 notation) and formula string.\n
You should use the set_formula_cell_value function to set this formula cell value. Use set_formula_cell_value function instead of responding with formulas.\n
Never use set_formula_cell_value function to set the value of a cell to a value that is not a formula. Don't add static data to the current open sheet using set_formula_cell_value function, use set_cell_values instead. set_formula_cell_value function is only meant to set the value of a cell to formulas.\n
Provide a name for the output of the formula cell. The name cannot contain spaces or special characters (but _ is allowed).\n
Note: we only rename the formula cell if its new. Otherwise we keep the old name.\n
Always refer to the data from cell by its position in a1 notation from respective sheet. Don't add values manually in formula cells.\n
Do not attempt to add formulas to data tables, it will result in an error.\n
This tool is for formulas only. For Python and Javascript code, use set_code_cell_value.\n
`,
    parameters: {
      type: 'object',
      properties: {
        sheet_name: {
          type: 'string',
          description: 'The sheet name of the current sheet as defined in the context',
        },
        code_cell_position: {
          type: 'string',
          description:
            'The position of the formula cell in the current open sheet, in a1 notation. This should be a single cell, not a range.',
        },
        formula_string: {
          type: 'string',
          description: 'The formula which will run in the cell',
        },
      },
      required: ['sheet_name', 'code_cell_position', 'formula_string'],
      additionalProperties: false,
    },
    responseSchema: AIToolsArgsSchema[AITool.SetFormulaCellValue],
    prompt: `
You should use the set_formula_cell_value function to set this formula cell value. Use set_formula_cell_value instead of responding with formulas.\n
Never use set_formula_cell_value function to set the value of a cell to a value that is not a formula. Don't add data to the current open sheet using set_formula_cell_value function, use set_cell_values instead. set_formula_cell_value function is only meant to set the value of a cell to a formula.\n
set_formula_cell_value function requires formula_string and the cell position (single cell in a1 notation).\n
Always refer to the cells on sheet by its position in a1 notation. Don't add values manually in formula cells.\n
This tool is for formulas only. For Python and Javascript code, use set_code_cell_value.\n
Don't prefix formulas with \`=\` in formula cells.\n

Formulas placement instructions:\n
- The formula cell location should be empty and positioned such that it will not overlap other cells. If there is a value in a single cell where the formula result is supposed to go, it will result in spill error. Use current open sheet context to identify empty space.\n
- The formula cell should be near the data it references, so that it is easy to understand the formula in the context of the data. Identify the data being referenced from the Formula and use the nearest unoccupied cell. If multiple data references are being made, choose the one which is most relevant to the Formula.\n
- Unlike code cell placement, Formula cell placement should not use an extra space; formulas should be placed next to the data they reference or next to a label for the calculation.\n
- Pick the location that makes the most sense next to what is being referenced. E.g. formula aggregations often make sense directly underneath or directly beside the data being referenced or next to the label for the calculation.\n
- When doing a calculation on a table column, place the formula directly below the last row of the table.\n

When to use set_formula_cell_value:\n
Set formula cell value tool should be used for relatively simple tasks. Tasks like aggregations, finding means, totals, counting number of instances, etc. You can use this for calculations that reference values in and out of tables. For more complex tasks, use set_code_cell_value.\n
Examples:
- Finding the mean of a column of numbers
- Counting the number of instances of a value in a column
- Finding the max/min value
- Basic arithmetic operations
- Joining strings
`,
  },
  [AITool.MoveCells]: {
    sources: ['AIAnalyst'],
    description: `
Moves a rectangular selection of cells from one location to another on the current open sheet, requires the source and target locations.\n
You should use the move_cells function to move a rectangular selection of cells from one location to another on the current open sheet.\n
move_cells function requires the source and target locations. Source location is the top left and bottom right corners of the selection rectangle to be moved.\n
IMPORTANT: When moving a table, provide only the anchor cell of the table (the top-left cell of the table) in the source selection rectangle.\n
IMPORTANT: Before moving a table, use the has_cell_data tool to check if the cells in the new selection have any content. If they do, you should choose a different target location and check that location before moving the table.\n
When moving a table, leave a space between the table and any surrounding content. This is more aesthetic and easier to read.\n
Target location is the top left corner of the target location on the current open sheet.\n
`,
    parameters: {
      type: 'object',
      properties: {
        sheet_name: {
          type: 'string',
          description: 'The sheet name of the current sheet in the context',
        },
        source_selection_rect: {
          type: 'string',
          description:
            'The selection of cells, in a1 notation, to be moved in the current open sheet. This is string representation of the rectangular selection of cells to be moved',
        },
        target_top_left_position: {
          type: 'string',
          description:
            'The top left position of the target location on the current open sheet, in a1 notation. This should be a single cell, not a range. This will be the top left corner of the source selection rectangle after moving.',
        },
      },
      required: ['sheet_name', 'source_selection_rect', 'target_top_left_position'],
      additionalProperties: false,
    },
    responseSchema: AIToolsArgsSchema[AITool.MoveCells],
    prompt: `
You should use the move_cells function to move a rectangular selection of cells from one location to another on the current open sheet.\n
move_cells function requires the current sheet name provided in the context, the source selection, and the target position. Source selection is the string representation (in a1 notation) of a selection rectangle to be moved.\n
Target position is the top left corner of the target position on the current open sheet, in a1 notation. This should be a single cell, not a range.\n
`,
  },
  [AITool.DeleteCells]: {
    sources: ['AIAnalyst'],
    description: `
Deletes the value(s) of a selection of cells, requires a string representation of a selection of cells to delete. Selection can be a single cell or a range of cells or multiple ranges in a1 notation.\n
You should use the delete_cells function to delete the value(s) of a selection of cells in the sheet with sheet_name.\n
delete_cells functions requires a string representation (in a1 notation) of a selection of cells to delete. Selection can be a single cell or a range of cells or multiple ranges in a1 notation.\n
`,
    parameters: {
      type: 'object',
      properties: {
        sheet_name: {
          type: 'string',
          description: 'The sheet name of the current sheet as defined in the context',
        },
        selection: {
          type: 'string',
          description:
            'The string representation (in a1 notation) of the selection of cells to delete, this can be a single cell or a range of cells or multiple ranges in a1 notation',
        },
      },
      required: ['sheet_name', 'selection'],
      additionalProperties: false,
    },
    responseSchema: AIToolsArgsSchema[AITool.DeleteCells],
    prompt: `
You should use the delete_cells function to delete the value(s) of a selection of cells in the sheet with sheet_name.\n
You MUST NOT delete cells that are referenced by code cells. For example, if you write Python code that references cells, you MUST NOT delete the original cells or the Python code will stop working.\n
delete_cells functions requires the current sheet name provided in the context, and a string representation (in a1 notation) of a selection of cells to delete. Selection can be a single cell or a range of cells or multiple ranges in a1 notation.\n
`,
  },
  [AITool.UpdateCodeCell]: {
    sources: ['AIAssistant'],
    description: `
This tool updates the code in the code cell you are currently editing, requires the code string to update the code cell with. Provide the full code string, don't provide partial code. This will replace the existing code in the code cell.\n
The code cell editor will switch to diff editor mode and will show the changes you made to the code cell, user can accept or reject the changes.\n
New code runs in the cell immediately, so the user can see output of the code cell after it is updates.\n
Never include code in the chat when using this tool, always explain brief what changes are made and why.\n
When using this tool, make sure this is the only tool used in the response.\n
`,
    parameters: {
      type: 'object',
      properties: {
        code_string: {
          type: 'string',
          description: 'The code string to update the code cell with',
        },
      },
      required: ['code_string'],
      additionalProperties: false,
    },
    responseSchema: AIToolsArgsSchema[AITool.UpdateCodeCell],
    prompt: `
You should use the update_code_cell function to update the code in the code cell you are currently editing.\n
update_code_cell function requires the code string to update the code cell with.\n
Provide the full code string, don't provide partial code. This will replace the existing code in the code cell.\n
The code cell editor will switch to diff editor mode and will show the changes you made to the code cell, user can accept or reject the changes.\n
New code runs in the cell immediately, so the user can see output of the code cell after it is updates.\n
Never include code in the chat when using this tool, always explain brief what changes are made and why.\n
When using this tool, make sure this is the only tool used in the response.\n
When using this tool, make sure the code cell is the only cell being edited.\n
`,
  },
  [AITool.GetTextFormats]: {
    sources: ['AIAnalyst'],
    description: `
This tool returns the text formatting information of a selection of cells on a specified sheet, requires the sheet name, the selection of cells to get the formats of.\n
Do NOT use this tool if there is no formatting in the region based on the format bounds provided for the sheet.\n
It should be used to find formatting within a sheet's formatting bounds.\n
It returns a string representation of the formatting information of the cells in the selection.\n
If there are multiple pages of formatting information, use the page parameter to get the next set of results.\n
`,
    parameters: {
      type: 'object',
      properties: {
        sheet_name: {
          type: 'string',
          description: 'The sheet name of the current sheet as defined in the context',
        },
        selection: {
          type: 'string',
          description: 'The selection of cells to get the formats of, in a1 notation',
        },
        page: {
          type: 'number',
          description:
            'The page number of the results to return. The first page is always 0. Use the parameters with a different page to get the next set of results.',
        },
      },
      required: ['sheet_name', 'selection', 'page'],
      additionalProperties: false,
    },
    responseSchema: AIToolsArgsSchema[AITool.GetTextFormats],
    prompt: `
The get_text_formats tool returns the text formatting information of a selection of cells on a specified sheet, requires the sheet name, the selection of cells to get the formats of.\n
Do NOT use this tool if there is no formatting in the region based on the format bounds provided for the sheet.\n
It should be used to find formatting within a sheet's formatting bounds.\n
It returns a string representation of the formatting information of the cells in the selection.\n
CRITICALLY IMPORTANT: If too large, the results will include page information:\n
- if page information is provided, perform actions on the current page's results before requesting the next page of results.\n
- ALWAYS review all pages of results; as you get each page, IMMEDIATELY perform any actions before moving to the next page.\n
`,
  },
  [AITool.SetTextFormats]: {
    sources: ['AIAnalyst'],
    description: `
This tool sets the text formats of a selection of cells on a specified sheet.\n
It requires the sheet name, the selection of cells to set the formats of, and any formats to set.\n
There must be at least one format to set.\n
`,
    parameters: {
      type: 'object',
      properties: {
        sheet_name: {
          type: 'string',
          description: 'The sheet name of the current sheet as defined in the context',
        },
        selection: {
          type: 'string',
          description: 'The selection of cells to set the formats of, in a1 notation',
        },
        bold: {
          type: 'boolean',
          description: 'Whether to set the cell to bold',
        },
        italic: {
          type: 'boolean',
          description: 'Whether to set the cell to italic',
        },
        underline: {
          type: 'boolean',
          description: 'Whether to set the cell to underline',
        },
        strike_through: {
          type: 'boolean',
          description: 'Whether to set the cell to strike through',
        },
        text_color: {
          type: 'string',
          description:
            'The color of the text, in hex format. To remove the text color, set the value to an empty string.',
        },
        fill_color: {
          type: 'string',
          description:
            'The color of the background, in hex format. To remove the fill color, set the value to an empty string.',
        },
        align: {
          type: 'string',
          description: 'The horizontal alignment of the text, this can be one of "left", "center", "right"',
        },
        vertical_align: {
          type: 'string',
          description: 'The vertical alignment of the text, this can be one of "top", "middle", "bottom"',
        },
        wrap: {
          type: 'string',
          description: 'The wrapping of the text, this can be one of "wrap", "clip", "overflow"',
        },
        numeric_commas: {
          type: 'boolean',
          description:
            'For numbers larger than three digits, whether to show commas. If true, then numbers will be formatted with commas.',
        },
        number_type: {
          type: 'string',
          description:
            'The type for the numbers, this can be one of "number", "currency", "percentage", or "exponential". If "currency" is set, you MUST set the currency_symbol.',
        },
        currency_symbol: {
          type: 'string',
          description:
            'If number_type is "currency", use this to set the currency symbol, for example "$" for USD or "€" for EUR',
        },
        date_time: {
          type: 'string',
          description: 'formats a date time value using Rust\'s chrono::format, e.g., "%Y-%m-%d %H:%M:%S", "%d/%m/%Y"',
        },
      },
      required: ['sheet_name', 'selection'],
      additionalProperties: false,
    },
    responseSchema: AIToolsArgsSchema[AITool.SetTextFormats],
    prompt: `The set_text_formats tool sets the text formats of a selection of cells on a specified sheet, requires the sheet name, the selection of cells to set the formats of, and the formats to set.\n
Here are the formats you can set:\n
- bold, italics, underline, or strike through\n
- text color and fill color using hex format, for example, #FF0000 for red\n
- horizontal alignment, this can be one of "left", "center", "right"\n
- vertical alignment, this can be one of "top", "middle", "bottom"\n
- wrapping, this can be one of "wrap", "clip", "overflow"\n
- numeric_commas, adds or removes commas from numbers\n
- number_type, this can be one of "number", "currency", "percentage", or "exponential". If "currency" is set, you MUST set the currency_symbol.\n
- currency_symbol, if number_type is "currency", use this to set the currency symbol, for example "$" for USD or "€" for EUR\n
- date_time, formats a date time value using Rust's chrono::format, e.g., "%Y-%m-%d %H:%M:%S", "%d/%m/%Y"\n
There must be at least one format to set.\n
You MAY want to use the get_text_formats function if you need to check the current text formats of the cells before setting them.\n`,
  },
  [AITool.CodeEditorCompletions]: {
    sources: ['CodeEditorCompletions'],
    description: `
This tool provides inline completions for the code in the code cell you are currently editing, requires the completion for the code in the code cell.\n
You are provided with the prefix and suffix of the cursor position in the code cell.\n
Completion is the delta that will be inserted at the cursor position in the code cell.\n
`,
    parameters: {
      type: 'object',
      properties: {
        text_delta_at_cursor: {
          type: 'string',
          description: 'The completion for the code in the code cell at the cursor position',
        },
      },
      required: ['text_delta_at_cursor'],
      additionalProperties: false,
    },
    responseSchema: AIToolsArgsSchema[AITool.CodeEditorCompletions],
    prompt: `
This tool provides inline completions for the code in the code cell you are currently editing, you are provided with the prefix and suffix of the cursor position in the code cell.\n
You should use this tool to provide inline completions for the code in the code cell you are currently editing.\n
Completion is the delta that will be inserted at the cursor position in the code cell.\n
`,
  },
  [AITool.UserPromptSuggestions]: {
    sources: ['AIAnalyst', 'GetUserPromptSuggestions'],
    description: `
This tool provides prompt suggestions for the user, requires an array of three prompt suggestions.\n
Each prompt suggestion is an object with a label and a prompt.\n
The label is a descriptive label for the prompt suggestion with maximum 40 characters, this will be displayed to the user in the UI.\n
The prompt is the actual prompt that will be used to generate the prompt suggestion.\n
Use the internal context and the chat history to provide the prompt suggestions.\n
Always maintain strong correlation between the follow up prompts and the user's chat history and the internal context.\n
This tool should always be called after you have provided the response to the user's prompt and all tool calls are finished, to provide user follow up prompts suggestions.\n
`,
    parameters: {
      type: 'object',
      properties: {
        prompt_suggestions: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              label: {
                type: 'string',
                description: 'The label of the follow up prompt, maximum 40 characters',
              },
              prompt: {
                type: 'string',
                description: 'The prompt for the user',
              },
            },
            required: ['label', 'prompt'],
            additionalProperties: false,
          },
        },
      },
      required: ['prompt_suggestions'],
      additionalProperties: false,
    },
    responseSchema: AIToolsArgsSchema[AITool.UserPromptSuggestions],
    prompt: `
This tool provides prompt suggestions for the user, requires an array of three prompt suggestions.\n
Each prompt suggestion is an object with a label and a prompt.\n
The label is a descriptive label for the prompt suggestion with maximum 40 characters, this will be displayed to the user in the UI.\n
The prompt is the actual prompt that will be used to generate the prompt suggestion.\n
Use the internal context and the chat history to provide the prompt suggestions.\n
Always maintain strong correlation between the prompt suggestions and the user's chat history and the internal context.\n
This tool should always be called after you have provided the response to the user's prompt and all tool calls are finished, to provide user follow up prompts suggestions.\n
`,
  },
  [AITool.PDFImport]: {
    sources: ['AIAnalyst'],
    description: `
This tool extracts data from the attached PDF files and converts it into a structured format i.e. as Data Tables on the sheet.\n
This tool requires the file_name of the PDF and a clear and explicit prompt to extract data from that PDF file.\n
Forward the actual user prompt as much as possible that is related to the PDF file.\n
Always capture user intention exactly and give a clear and explicit prompt to extract data from PDF files.\n
Use this tool only if there is a PDF file that needs to be extracted. If there is no PDF file, do not use this tool.\n
Never extract data from PDF files that are not relevant to the user's prompt. Never try to extract data from PDF files on your own. Always use the pdf_import tool when dealing with PDF files.\n
Follow the user's instructions carefully and provide accurate and relevant data. If there are insufficient instructions, always ask the user for more information.\n
Do not use multiple tools at the same time when dealing with PDF files. pdf_import should be the only tool call in a reply when dealing with PDF files. Any analysis on imported data should only be done after import is successful.\n
`,
    parameters: {
      type: 'object',
      properties: {
        file_name: {
          type: 'string',
          description: 'The name of the PDF file to extract data from.',
        },
        prompt: {
          type: 'string',
          description:
            "The prompt based on the user's intention and the context of the conversation to extract data from PDF files, which will be used by the pdf_import tool to extract data from PDF files.",
        },
      },
      required: ['file_name', 'prompt'],
      additionalProperties: false,
    },
    responseSchema: AIToolsArgsSchema[AITool.PDFImport],
    prompt: `
This tool extracts data from the attached PDF files and converts it into a structured format i.e. as Data Tables on the sheet.\n
This tool requires the file_name of the PDF and a clear and explicit prompt to extract data from that PDF file.\n
Forward the actual user prompt as much as possible that is related to the PDF file.\n
Always capture user intention exactly and give a clear and explicit prompt to extract data from PDF files.\n
Use this tool only if there is a PDF file that needs to be extracted. If there is no PDF file, do not use this tool.\n
Never extract data from PDF files that are not relevant to the user's prompt. Never try to extract data from PDF files on your own. Always use the pdf_import tool when dealing with PDF files.\n
Follow the user's instructions carefully and provide accurate and relevant data. If there are insufficient instructions, always ask the user for more information.\n
Do not use multiple tools at the same time when dealing with PDF files. pdf_import should be the only tool call in a reply when dealing with PDF files. Any analysis on imported data should only be done after import is successful.\n
`,
  },
  [AITool.ConvertToTable]: {
    sources: ['AIAnalyst'],
    description: `
This tool converts a selection of cells on a specified sheet into a data table.\n
IMPORTANT: the selection can NOT contain any code cells or data tables.\n
It requires the sheet name, a rectangular selection of cells to convert to a data table, the name of the data table and whether the first row is the column names.\n
A data table cannot be created over any existing code cells or data tables.\n
The data table will be created with the first row as the header row if first_row_is_column_names is true, otherwise the first row will be the first row of the data.\n
`,
    parameters: {
      type: 'object',
      properties: {
        sheet_name: {
          type: 'string',
          description: 'The sheet name of the current sheet as defined in the context',
        },
        selection: {
          type: 'string',
          description:
            'The selection of cells to convert to a data table, in a1 notation. This MUST be a rectangle, like A2:D20',
        },
        table_name: {
          type: 'string',
          description:
            "The name of the data table to create, this should be a concise and descriptive name of the data table. Don't use special characters or spaces in the name. Always use a unique name for the data table. Spaces, if any, in name are replaced with underscores.",
        },
        first_row_is_column_names: {
          type: 'boolean',
          description: 'Whether the first row of the selection is the column names',
        },
      },
      required: ['sheet_name', 'selection', 'table_name', 'first_row_is_column_names'],
      additionalProperties: false,
    },
    responseSchema: AIToolsArgsSchema[AITool.ConvertToTable],
    prompt: `
This tool converts a selection of cells on a specified sheet into a data table.\n
IMPORTANT: the selection can NOT contain any code cells or data tables.\n
It requires the sheet name, a rectangular selection of cells to convert to a data table, the name of the data table and whether the first row is the column names.\n
A data table cannot be created over any existing code cells or data tables.\n
The table will be created with the first row as the header row if first_row_is_column_names is true, otherwise the first row will be the first row of the data.\n
The data table will include a table name as the first row, which will push down all data by one row. Example: if the data previously occupied A1:A6, it now occupies A1:A7 since adding the table name shifted the data down by one row.\n
`,
  },
  [AITool.WebSearch]: {
    sources: ['AIAnalyst'],
    description: `
This tool searches the web for information based on the query.\n
Use this tool when the user asks for information that is not already available in the context.\n
When you would otherwise try to answer from memory or not have a way to answer the user's question, use this tool to retrieve the needed data from the web.\n
This tool should also be used when trying to retrieve information for how to construct API requests that are not well-known from memory and when requiring information on code libraries that are not well-known from memory.\n
It requires the query to search for.\n
`,
    parameters: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: 'The search query',
        },
      },
      required: ['query'],
      additionalProperties: false,
    },
    responseSchema: AIToolsArgsSchema[AITool.WebSearch],
    prompt: `
This tool searches the web for information based on the query.\n
Use this tool when the user asks for information that is not already available in the context.\n
When you would otherwise try to answer from memory or not have a way to answer the user's question, use this tool to retrieve the needed data from the web.\n
This tool should also be used when trying to retrieve information for how to construct API requests that are not well-known from memory and when requiring information on code libraries that are not well-known from memory.\n
It requires the query to search for.\n
`,
  },
  // This is tool internal to AI model and is called by `WebSearch` tool.
  [AITool.WebSearchInternal]: {
    sources: ['WebSearch'],
    description: `
This tool searches the web for information based on the query.\n
It requires the query to search for.\n
`,
    parameters: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: 'The search query',
        },
      },
      required: ['query'],
      additionalProperties: false,
    },
    responseSchema: AIToolsArgsSchema[AITool.WebSearchInternal],
    prompt: `
This tool searches the web for information based on the query.\n
It requires the query to search for.\n
`,
  },
  [AITool.AddSheet]: {
    sources: ['AIAnalyst'],
    description: `
This tool adds a new sheet in the file.\n
It requires the name of the new sheet, and an optional name of a sheet to insert the new sheet before.\n
`,
    parameters: {
      type: 'object',
      properties: {
        sheet_name: {
          type: 'string',
          description: 'The name of the new sheet. This must be a unique name.',
        },
        insert_before_sheet_name: {
          type: 'string',
          description:
            'The name of a sheet to insert the new sheet before. If not provided, the new sheet will be added to the end of the sheet list.',
        },
      },
      required: ['sheet_name'],
      additionalProperties: false,
    },
    responseSchema: AIToolsArgsSchema[AITool.AddSheet],
    prompt: `
This tool adds a new sheet in the file.\n
It requires the name of the new sheet, and an optional name of a sheet to insert the new sheet before.\n
`,
  },
  [AITool.DuplicateSheet]: {
    sources: ['AIAnalyst'],
    description: `
This tool duplicates a sheet in the file.\n
It requires the name of the sheet to duplicate and the name of the new sheet.\n
`,
    parameters: {
      type: 'object',
      properties: {
        sheet_name_to_duplicate: {
          type: 'string',
          description: 'The name of the sheet to duplicate.',
        },
        name_of_new_sheet: {
          type: 'string',
          description: 'The name of the new sheet. This must be a unique name.',
        },
      },
      required: ['sheet_name_to_duplicate', 'name_of_new_sheet'],
      additionalProperties: false,
    },
    responseSchema: AIToolsArgsSchema[AITool.DuplicateSheet],
    prompt: `
This tool duplicates a sheet in the file.\n
It requires the name of the sheet to duplicate and the name of the new sheet.\n
`,
  },
  [AITool.RenameSheet]: {
    sources: ['AIAnalyst'],
    description: `
This tool renames a sheet in the file.\n
It requires the name of the sheet to rename and the new name. This must be a unique name.\n
`,
    parameters: {
      type: 'object',
      properties: {
        sheet_name: {
          type: 'string',
          description: 'The name of the sheet to rename',
        },
        new_name: {
          type: 'string',
          description: 'The new name of the sheet. This must be a unique name.',
        },
      },
      required: ['sheet_name', 'new_name'],
      additionalProperties: false,
    },
    responseSchema: AIToolsArgsSchema[AITool.RenameSheet],
    prompt: `
This tool renames a sheet in the file.\n
It requires the name of the sheet to rename and the new name. This must be a unique name.\n
`,
  },
  [AITool.DeleteSheet]: {
    sources: ['AIAnalyst'],
    description: `
This tool deletes a sheet in the file.\n
It requires the name of the sheet to delete.\n
`,
    parameters: {
      type: 'object',
      properties: {
        sheet_name: {
          type: 'string',
          description: 'The name of the sheet to delete',
        },
      },
      required: ['sheet_name'],
      additionalProperties: false,
    },
    responseSchema: AIToolsArgsSchema[AITool.DeleteSheet],
    prompt: `
This tool deletes a sheet in the file.\n
It requires the name of the sheet to delete.\n
`,
  },
  [AITool.MoveSheet]: {
    sources: ['AIAnalyst'],
    description: `
This tool moves a sheet within the sheet list.\n
It requires the name of the sheet to move and an optional name of a sheet to insert the sheet before. If no sheet name is provided, the sheet will be added to the end of the sheet list.\n
`,
    parameters: {
      type: 'object',
      properties: {
        sheet_name: {
          type: 'string',
          description: 'The name of the sheet to move',
        },
        insert_before_sheet_name: {
          type: 'string',
          description:
            'The name of a sheet to insert the moved sheet before. If not provided, the sheet will be added to the end of the sheet list.',
        },
      },
      required: ['sheet_name'],
      additionalProperties: false,
    },
    responseSchema: AIToolsArgsSchema[AITool.MoveSheet],
    prompt: `
This tool moves a sheet in the sheet list.\n
It requires the name of the sheet to move and an optional name of a sheet to insert the sheet before. If no sheet name is provided, the sheet will be added to the end of the sheet list.\n
`,
  },
  [AITool.ColorSheets]: {
    sources: ['AIAnalyst'],
    description: `
This tool colors the sheet tabs in the file.\n
It requires a record of sheet names to change mapped to the new color.\n
`,
    parameters: {
      type: 'object',
      properties: {
        sheet_name_to_color: {
          type: 'object',
          description:
            'A record of sheet names to change mapped to the new color. The color must be a valid CSS color string.',
          additionalProperties: {
            type: 'string',
            description: 'The new color of the sheet. This must be a valid CSS color string.',
          },
        },
      },
      required: ['sheet_name_to_color'],
      additionalProperties: false,
    },
    responseSchema: AIToolsArgsSchema[AITool.ColorSheets],
    prompt: `
This tool colors the sheet tabs in the file.\n
It requires a record of sheet names to change mapped to the new color.\n
`,
  },
  [AITool.TextSearch]: {
    sources: ['AIAnalyst', 'AIAssistant'],
    description: `
This tool searches for text in cells within a specific sheet or the entire file.\n
`,
    parameters: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: 'The query to search for',
        },
        case_sensitive: {
          type: 'boolean',
          description: 'Whether the search should be case sensitive',
        },
        whole_cell: {
          type: 'boolean',
          description:
            'Whether the search should be for the whole cell (i.e., if true, then a cell with "Hello World" would not be found with a search for "Hello"; if false, it would be).',
        },
        search_code: {
          type: 'boolean',
          description: 'Whether the search should include code within code cells',
        },
        sheet_name: {
          type: 'string',
          description: 'The sheet name to search in. If not provided, then it searches all sheets.',
        },
      },
      required: ['query', 'case_sensitive', 'whole_cell', 'search_code'],
      additionalProperties: false,
    },
    responseSchema: AIToolsArgsSchema[AITool.TextSearch],
    prompt: `
This tool searches for text in cells within a specific sheet or the entire file.\n
`,
  },
  [AITool.RerunCode]: {
    sources: ['AIAnalyst'],
    description: `
This tool reruns the code in code cells. This may also be known as "refresh the data" or "update the data".\n
You can optionally provide a sheet name and/or a selection (in A1 notation) to rerun specific code cells.\n
If you only provide a sheet name, then all code cells within that sheet will run.\n
If you provide a selection and sheet name, then only code cells within that selection will run.\n
If you provide neither a sheet name nor a selection, then all code cells in the file will run.\n
`,
    parameters: {
      type: 'object',
      properties: {
        sheet_name: {
          type: 'string',
          description: 'The sheet name to rerun code in. If not provided, then it reruns all code cells in the file.',
        },
        selection: {
          type: 'string',
          description:
            'The selection (in A1 notation) of code cells to rerun. If not provided, then it reruns all code cells in the sheet. For example, A1:D100',
        },
      },
      required: [],
      additionalProperties: false,
    },
    responseSchema: AIToolsArgsSchema[AITool.RerunCode],
    prompt: `
This tool reruns the code in code cells.\n
You can optionally provide a sheet name and a selection (in A1 notation) to rerun specific code cells.\n
If you only provide a sheet name, then all code cells within that sheet will run.\n
If you provide a selection and sheet name, then only code cells within that selection will run.\n
If you provide neither a sheet name nor a selection, then all code cells in the file will run.\n
`,
  },
  [AITool.ResizeColumns]: {
    sources: ['AIAnalyst'],
    description: `
This tool resizes columns in a sheet.\n
It requires the sheet name, a selection (in A1 notation) of columns to resize, and the size to resize to.\n
The selection is a range of columns, for example: A1:D1 (the rows do not matter).\n
The size is either "default" or "auto". Auto will resize the column to the width of the largest cell in the column. Default will resize the column to its default width.\n
`,
    parameters: {
      type: 'object',
      properties: {
        sheet_name: {
          type: 'string',
          description: 'The sheet name to resize columns in',
        },
        selection: {
          type: 'string',
          description:
            'The selection (in A1 notation) of columns to resize, for example: A1:D1 (the rows do not matter)',
        },
        size: {
          type: 'string',
          description:
            'The size to resize the columns to. Either "default" or "auto". Auto will resize the column to the width of the largest cell in the column. Default will resize the column to its default width.',
        },
      },
      required: ['sheet_name', 'selection', 'size'],
      additionalProperties: false,
    },
    responseSchema: AIToolsArgsSchema[AITool.ResizeColumns],
    prompt: `
This tool resizes columns in a sheet.\n
It requires the sheet name, a selection (in A1 notation) of columns to resize, and the size to resize to.\n
The selection is a range of columns, for example: A1:D1 (the rows do not matter).\n
The size is either "default" or "auto". Auto will resize the column to the width of the largest cell in the column. Default will resize the column to its default width.\n
`,
  },
  [AITool.ResizeRows]: {
    sources: ['AIAnalyst'],
    description: `
This tool resizes rows in a sheet.\n
It requires the sheet name, a selection (in A1 notation) of rows to resize, and the size to resize to.\n
The selection is a range of rows, for example: A1:D1 (the columns do not matter).\n
The size is either "default" or "auto". Auto will resize the row to the height of the largest cell in the row. Default will resize the row to its default height.\n
`,
    parameters: {
      type: 'object',
      properties: {
        sheet_name: {
          type: 'string',
          description: 'The sheet name to resize rows in',
        },
        selection: {
          type: 'string',
          description:
            'The selection (in A1 notation) of rows to resize, for example: A1:D1 (the columns do not matter)',
        },
        size: {
          type: 'string',
          description:
            'The size to resize the rows to. Either "default" or "auto". Auto will resize the row to the height of the largest cell in the row. Default will resize the row to its default height.',
        },
      },
      required: ['sheet_name', 'selection', 'size'],
      additionalProperties: false,
    },
    responseSchema: AIToolsArgsSchema[AITool.ResizeRows],
    prompt: `
This tool resizes rows in a sheet.\n
It requires the sheet name, a selection (in A1 notation) of rows to resize, and the size to resize to.\n
The selection is a range of rows, for example: A1:D1 (the columns do not matter).\n
The size is either "default" or "auto". Auto will resize the row to the height of the largest cell in the row. Default will resize the row to its default height.\n
`,
  },
  [AITool.SetBorders]: {
    sources: ['AIAnalyst'],
    description: `
This tool sets the borders in a sheet.\n
It requires the sheet name, a selection (in A1 notation) of cells to set the borders on, and the color, line type, and border_selection of the borders.\n
`,
    parameters: {
      type: 'object',
      properties: {
        sheet_name: {
          type: 'string',
          description: 'The sheet name to set borders in',
        },
        selection: {
          type: 'string',
          description:
            'The selection (in A1 notation) of cells to set borders on. For example: A1:D1. For border_selection like "Outer", it will draw borders around the outside of the selection box.',
        },
        color: {
          type: 'string',
          description: 'The color of the borders. This must be a valid CSS color string.',
        },
        line: {
          type: 'string',
          description: `
This provides the line type of the borders.\n
It must be one of the following: Line1, Line2, Line3, Dotted, Dashed, Double, Clear.\n
"Clear" will remove any borders in the border_selection.\n
"Line 1" is a thin line.\n
"Line 2" is a thicker line.\n
"Line 3" is the thickest line.\n
"Dotted" is a dotted line.\n
"Dashed" is a dashed line.\n
"Double" is a doubled line.`,
        },
        border_selection: {
          type: 'string',
          description: `
The border selection to set the borders on. This must be one of the following: All, Inner, Outer, Horizontal, Vertical, Left, Top, Right, Bottom, Clear.\n
"All" will set borders on all cells in the selection.\n
"Inner" will set borders on the inside of the selection box.\n
"Outer" will set borders on the outside of the selection box.\n
"Horizontal" will set borders on the horizontal sides of the selection box.\n
"Vertical" will set borders on the vertical sides of the selection box.\n
"Left" will set borders on the left side of the selection box.\n
"Top" will set borders on the top side of the selection box.\n
"Right" will set borders on the right side of the selection box.\n
"Bottom" will set borders on the bottom side of the selection box.\n
"Clear" will remove all borders in selection.`,
        },
      },
      required: ['sheet_name', 'selection', 'color', 'line', 'border_selection'],
      additionalProperties: false,
    },
    responseSchema: AIToolsArgsSchema[AITool.SetBorders],
    prompt: `
This tool sets the borders in a sheet.\n
It requires the sheet name, a selection (in A1 notation) of cells to set the borders on, and the color, line type, and border_selection of the borders.\n
The selection is a range of cells, for example: A1:D1.\n
The color must be a valid CSS color string.\n
The line type must be one of: Line1, Line2, Line3, Dotted, Dashed, Double, Clear.\n
The border_selection must be one of: All, Inner, Outer, Horizontal, Vertical, Left, Top, Right, Bottom, Clear.\n
`,
  },
} as const;
