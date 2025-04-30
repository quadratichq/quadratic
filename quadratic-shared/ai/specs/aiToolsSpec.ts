import type { AISource, AIToolArgs } from 'quadratic-shared/typesAndSchemasAI';
import { z } from 'zod';

export enum AITool {
  SetChatName = 'set_chat_name',
  AddDataTable = 'add_data_table',
  SetCellValues = 'set_cell_values',
  SetCodeCellValue = 'set_code_cell_value',
  MoveCells = 'move_cells',
  DeleteCells = 'delete_cells',
  UpdateCodeCell = 'update_code_cell',
  CodeEditorCompletions = 'code_editor_completions',
  UserPromptSuggestions = 'user_prompt_suggestions',
  PDFImport = 'pdf_import',
}

export const AIToolSchema = z.enum([
  AITool.SetChatName,
  AITool.AddDataTable,
  AITool.SetCellValues,
  AITool.SetCodeCellValue,
  AITool.MoveCells,
  AITool.DeleteCells,
  AITool.UpdateCodeCell,
  AITool.CodeEditorCompletions,
  AITool.UserPromptSuggestions,
  AITool.PDFImport,
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
  .pipe(z.enum(['python', 'javascript', 'formula']))
  .transform((val) => val.charAt(0).toUpperCase() + val.slice(1))
  .pipe(z.enum(['Python', 'Javascript', 'Formula']));

export const AIToolsArgsSchema = {
  [AITool.SetChatName]: z.object({
    chat_name: z.string(),
  }),
  [AITool.AddDataTable]: z.object({
    top_left_position: z.string(),
    table_name: z.string(),
    table_data: array2DSchema,
  }),
  [AITool.SetCodeCellValue]: z.object({
    code_cell_language: cellLanguageSchema,
    code_cell_position: z.string(),
    code_string: z.string(),
  }),
  [AITool.SetCellValues]: z.object({
    top_left_position: z.string(),
    cell_values: array2DSchema,
  }),
  [AITool.MoveCells]: z.object({
    source_selection_rect: z.string(),
    target_top_left_position: z.string(),
  }),
  [AITool.DeleteCells]: z.object({
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
} as const;

export type AIToolSpecRecord = {
  [K in AITool]: AIToolSpec<K>;
};

export const aiToolsSpec: AIToolSpecRecord = {
  [AITool.SetChatName]: {
    sources: ['GetChatName'],
    description: `
Sets the name of the user's chat session. The name should be concise, user-facing, and reflect the conversation's topic or goal based on the user's queries.
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
    prompt: `
Provide a concise name for this conversation based on the user's goal or topic. Use plain language from the user's perspective, such as "Predictive Analytics" or "Help with budgeting".
`,
  },
  [AITool.AddDataTable]: {
    sources: ['AIAnalyst', 'PDFImport'],
    description: `
Adds a new data table to the current open sheet. Requires a top-left anchor position (A1 notation), a unique table name, and a 2D array of string values. The first row of data is used as the table header, and all rows must be the same length. This tool should be used only for adding new tabular data—not for modifying existing tables, inserting formulas, or adding results summaries. When adding sample data always fill in all the sample data cells, unless the user asks you to leave space. NEVER leave space for Formula inputs since they can't be added to data tables.
`,
    parameters: {
      type: 'object',
      properties: {
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
      required: ['top_left_position', 'table_name', 'table_data'],
      additionalProperties: false,
    },
    responseSchema: AIToolsArgsSchema[AITool.AddDataTable],
    prompt: `
Use this tool to add a new structured data table to the current open sheet. Provide:
- A top-left position in A1 notation (e.g., "B2")
- A unique table name (e.g., "customer_orders")
- A 2D array of string values, where the first row is the header

When adding sample data always fill in all the sample data cells, unless the user asks you to leave space. NEVER leave space for Formula inputs since they can't be added to data tables.\n
`,
  },
  [AITool.SetCellValues]: {
    sources: ['AIAnalyst'],
    description: `
Sets values in the current open sheet using a 2D array of strings, starting at a specified top-left cell (in A1 notation). Each sub-array represents a row. Values can include text, numbers, booleans, dates, durations, or be blank. This tool is for general cell data entry, not formulas or code.
`,
    parameters: {
      type: 'object',
      properties: {
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
      required: ['top_left_position', 'cell_values'],
      additionalProperties: false,
    },
    responseSchema: AIToolsArgsSchema[AITool.SetCellValues],
    prompt: `
Use this tool to set cell values in the current open sheet. Provide:
- A top-left position (e.g., "A1") to anchor the data
- A 2D array of string values (each sub-array is a row)
Values may include text, numbers, dates, or blanks. To clear a cell, pass an empty string. Do not use this tool for adding formulas or code — use set_code_cell_value for that.
`,
  },
  [AITool.SetCodeCellValue]: {
    sources: ['AIAnalyst'],
    description: `
Inserts code into a specified code cell and executes it on the current open sheet. Requires the code language, the cell position (A1 notation), and the code string. Only use this tool for adding executable code — not for adding raw data, formulas, or values to tables. Code output may include visualizations or results that spill into adjacent cells.
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
            'The position of the code cell in the current open sheet, in a1 notation. This should be a single cell, not a range.',
        },
        code_string: {
          type: 'string',
          description: 'The code which will run in the cell',
        },
      },
      required: ['code_cell_language', 'code_cell_position', 'code_string'],
      additionalProperties: false,
    },
    responseSchema: AIToolsArgsSchema[AITool.SetCodeCellValue],
    prompt: `
Use this tool to insert code into the current open sheet. Provide:
- The code cell position (a single, empty cell in A1 notation)
- The code language: "Python", "Javascript", or "Formula"
- The code string

Placement rules:
- Place the code cell **near the data it references**:
  - For portrait tables → use the top-right corner
  - For landscape tables → use the bottom-left corner
- Leave a blank row or column between the code cell and the data it references
- Avoid placing the code cell where outputs may collide with existing content
- Code outputs (e.g. plots) require 7 columns × 23 rows of free space

Do not:
- Use this to add static values or formulas (use set_cell_values instead)
- Place code inside data tables
- Use conditionals to return data (Python only returns final unconditional expression)
- Prefix formulas with = (omit it in Formula cells)
 `,
  },
  [AITool.MoveCells]: {
    sources: ['AIAnalyst'],
    description: `
Moves a rectangular block of cells from one location to another on the current open sheet. Requires the source selection (in A1 range format) and the target position (top-left cell). The source defines the area to move; the target defines where its top-left corner should end up.
`,
    parameters: {
      type: 'object',
      properties: {
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
      required: ['source_selection_rect', 'target_top_left_position'],
      additionalProperties: false,
    },
    responseSchema: AIToolsArgsSchema[AITool.MoveCells],
    prompt: `
Use this tool to move a rectangular selection of cells from one place to another in the current open sheet.

- **source_selection_rect**: a rectangular A1 range (e.g., "B2:D5")
- **target_top_left_position**: a single cell (e.g., "G2") that will become the new top-left corner

All cell contents will be moved — not copied — and the original area will be cleared.
`,
  },
  [AITool.DeleteCells]: {
    sources: ['AIAnalyst'],
    description: `
Clears the values from a selection of cells on the current open sheet. Accepts a single cell, a range (e.g., "B2:D5"), or multiple ranges (e.g., "A1,A3,B2:D4") in A1 notation.
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
    prompt: `
Use this tool to clear the contents of one or more cells on the current open sheet.

- selection: A1-style reference to a single cell, a range, or multiple ranges (e.g., "A1", "B2:D4", "A1,C3,F2:G4")
`,
  },
  [AITool.UpdateCodeCell]: {
    sources: ['AIAssistant'],
    description: `
Replaces the full contents of the code cell currently being edited with a new code string. The new code is immediately executed, and the user will see a diff view showing the changes. Only use this tool to replace the entire code block, not to append or partially modify. Do not include the code in the assistant message — only use this tool, and briefly describe the change.
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
    sources: ['GetUserPromptSuggestions', 'AIAnalyst'],
    description: `
Generates an array of three follow-up prompt suggestions for the user. Each suggestion includes a short label (max 40 characters) and a full prompt string. Use the user's chat history and internal context to generate relevant, helpful next steps. This tool should only be called after all tool calls are complete and the assistant response has been delivered.
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
Suggest three helpful follow-up prompts based on the user’s recent query and the internal context.

Each suggestion must include:
- A concise label (≤40 characters) summarizing the action
- A full prompt string to run when selected

Examples:
- Label: “Add growth forecast” → Prompt: “Can you project future growth based on this data?”
- Label: “Visualize sales trends” → Prompt: “Generate a chart of monthly sales trends.”

Only use this tool after the main response is complete and all tool calls are finished.
`,
  },
  [AITool.PDFImport]: {
    sources: ['AIAnalyst'],
    description: `
Extracts structured data from an attached PDF and converts it into one or more Data Tables on the current sheet. Requires the file name and a prompt that clearly reflects the user's intent. Use only when a relevant PDF is attached and the user has asked to extract data from it.
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
Use this tool only when the user has attached a PDF **and** asked to extract structured data from it.

- Use the **exact file name** of the attached PDF.
- The prompt must clearly express **what the user wants extracted** (e.g., “Extract the revenue table on page 2”).
- Forward the user's wording as much as possible — capture their intention accurately.
- Do not guess or extract anything not explicitly requested.
- Only include this tool in your response — analysis comes **after** the data is imported.

Never use this tool if no relevant PDF is attached or the user's prompt doesn’t call for extraction.
`,
  },
} as const;
