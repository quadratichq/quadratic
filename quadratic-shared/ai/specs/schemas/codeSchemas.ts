import { z } from 'zod';
import type { AIToolSpec } from '../aiToolsCore';
import { AITool, cellLanguageSchema, stringNullableOptionalSchema, stringSchema } from '../aiToolsCore';

// Zod schemas for code tools
export const codeToolsArgsSchemas = {
  [AITool.GetCodeCellValue]: z.object({
    sheet_name: z.string().nullable().optional(),
    code_cell_name: z.string().nullable().optional(),
    code_cell_position: z.string().nullable().optional(),
  }),
  [AITool.SetCodeCellValue]: z.object({
    sheet_name: stringNullableOptionalSchema,
    code_cell_name: stringSchema,
    code_cell_language: cellLanguageSchema,
    code_cell_position: stringSchema,
    code_string: stringSchema,
  }),
  [AITool.SetFormulaCellValue]: z.object({
    formulas: z
      .array(
        z.object({
          sheet_name: stringNullableOptionalSchema,
          code_cell_position: stringSchema,
          formula_string: stringSchema,
        })
      )
      .min(1),
  }),
  [AITool.UpdateCodeCell]: z.object({
    code_string: stringSchema,
  }),
  [AITool.CodeEditorCompletions]: z.object({
    text_delta_at_cursor: stringSchema,
  }),
  [AITool.RerunCode]: z.object({
    sheet_name: z.string().nullable().optional(),
    selection: z.string().nullable().optional(),
  }),
} as const;

// Specs for code tools
export const codeToolsSpecs: { [K in keyof typeof codeToolsArgsSchemas]: AIToolSpec } = {
  [AITool.GetCodeCellValue]: {
    sources: ['AIAnalyst'],
    aiModelModes: ['disabled', 'fast', 'max', 'others'],
    description: `
This tool gets the full code for a Python, JavaScript, Formula, or connection cell.\n
Use this tool to view the code in an existing code cell so you can fix errors or make improvements. Once you've read the code, you can improve it using the set_code_cell_value tool call.\n
This tool should be used when users want to make updates to an existing code cell that isn't already in context.\n`,
    parameters: {
      type: 'object',
      properties: {
        sheet_name: {
          type: 'string',
          description: 'The sheet name of the current sheet as defined in the context',
        },
        code_cell_name: {
          type: 'string',
          description: 'The name of the code cell to get the value of',
        },
        code_cell_position: {
          type: 'string',
          description: 'The position of the code cell to get the value of, in a1 notation',
        },
      },
      required: ['sheet_name', 'code_cell_name', 'code_cell_position'],
      additionalProperties: false,
    },
    responseSchema: codeToolsArgsSchemas[AITool.GetCodeCellValue],
    prompt: `
This tool gets the full code for a Python, JavaScript, Formula, or connection cell.\n
Use this tool to view the code in an existing code cell so you can fix errors or make improvements. Once you've read the code, you can improve it using the set_code_cell_value tool call.\n
This tool should be used when users want to make updates to an existing code cell that isn't already in context.\n`,
  },
  [AITool.SetCodeCellValue]: {
    sources: ['AIAnalyst'],
    aiModelModes: ['disabled', 'fast', 'max', 'others'],
    description: `
Sets the value of a code cell and runs it in the current open sheet, requires the language (Python or Javascript), cell position (in a1 notation), and code string.\n
Default output size of a new plot/chart is 7 wide * 23 tall cells.\n
You should use the set_code_cell_value function to set code cell values; use set_code_cell_value function instead of responding with code.\n
Never use set_code_cell_value function to set the value of a cell to a value that is not code. Don't add static data to the current open sheet using set_code_cell_value function, use set_cell_values instead. set_code_cell_value function is only meant to set the value of a cell to code.\n
Provide a name for the output of the code cell. The name cannot contain spaces or special characters (but _ is allowed).\n
Note: only name the code cell if it is new.\n
If this tool created a spill you MUST delete the original code cell and recreate it at a different location to avoid multiple code cells in the sheet.
Always refer to the data from cell by its position in a1 notation from respective sheet.\n
Do not attempt to add code to data tables, it will result in an error.\n
Do NOT delete the source data or tables that the code cell references unless the user explicitly asks you to. The code depends on this data to function correctly.\n
This tool is for Python and Javascript code only. For formulas, use set_formula_cell_value. For SQL Connections, use set_sql_code_cell_value.\n\n

Code cell (Python and Javascript) placement instructions:\n
- Determine the approximate output size of the code cell before placing it.
- By default, charts will output 7 wide * 23 tall cells (if columns and rows have default width and height). If the code cell is placed in a location that is not empty, it will result in spill error.
- The code cell location should be empty and positioned such that it will not overlap other cells. If there is a value in a single cell where the code result is supposed to go, it will result in spill error. Use current open sheet context to identify empty space.\n
- Leave one extra column gap between the code cell being placed and the nearest content if placing horizontally. If placing vertically, leave one extra row gap between the code cell and the nearest content.
- Pick a location that makes sense relative to the existing contents of the sheet. Line up placements with existing content. E.g. if placing next to a table at A1:C19, place the code cell at E1 (keeping in mind the extra column gap since placing horizontally).
- In case there is not enough empty space near the existing contents of the sheet, choose a distant empty cell.\n
- Consider the overall layout and organization of the current open sheet when placing the code cell, ensuring it doesn't disrupt existing data or interfere with other code cells.\n
- A plot returned by the code cell occupies space on the sheet and spills if there is any data present in the sheet where the plot is supposed to be placed. Default output size of a new plot is 7 wide * 23 tall cells.\n
- Cursor location should not impact placement decisions.\n
- If the sheet is empty, place the code cell at A1.\n
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
          description: 'The language of the code cell, this can be one of Python or Javascript.',
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
    responseSchema: codeToolsArgsSchemas[AITool.SetCodeCellValue],
    prompt: `
Use set_code_cell_value instead of responding with code.\n
set_code_cell_value tool is used to add Python or Javascript code cell to the sheet.\n
Set code cell value tool should be used for relatively complex tasks. Tasks like data transformations, correlations, machine learning, slicing, etc. For more simple tasks, use set_formula_cell_value.\n
If this tool created a spill you MUST delete the original code cell and recreate it at a different location to avoid multiple code cells in the sheet.
Never use set_code_cell_value function to set the value of a cell to a value that is not code. Don't add data to the current open sheet using set_code_cell_value function, use set_cell_values instead. set_code_cell_value function is only meant to set the value of a cell to code.\n
set_code_cell_value function requires language, codeString, and the cell position (single cell in a1 notation).\n
Always refer to the cells on sheet by its position in a1 notation, using q.cells function. Don't add values manually in code cells.\n
Do NOT delete the source data or tables that the code cell references unless the user explicitly asks you to. The code depends on this data to function correctly.\n
This tool is for Python and Javascript code only. For formulas, use set_formula_cell_value.\n

Code cell (Python and Javascript) placement instructions:\n
- The code cell location should be empty and positioned such that it will not overlap other cells. If there is a value in a single cell where the code result is supposed to go, it will result in spill error. Use current open sheet context to identify empty space.\n
- Leave one extra column gap between the code cell being placed and the nearest content if placing horizontally. If placing vertically, leave one extra row gap between the code cell and the nearest content.\n
- Pick a location that makes sense relative to the existing contents of the sheet. Line up placements with existing content. E.g. if placing next to a table at A1:C19, place the code cell at E1 (keeping in mind the extra column gap since placing horizontally).\n
- In case there is not enough empty space near the existing contents of the sheet, choose a distant empty cell.\n
- Consider the overall layout and organization of the current open sheet when placing the code cell, ensuring it doesn't disrupt existing data or interfere with other code cells.\n
- A plot returned by the code cell occupies space on the sheet and spills if there is any data present in the sheet where the plot is supposed to be placed. Default output size of a new plot is 7 wide * 23 tall cells.\n
- Cursor location should not impact placement decisions.\n
- If the sheet is empty, place the code cell at A1.\n

Think carefully about the placement rules and examples. Always ensure the code cell is placed where it does not create a spill error.
IMPORTANT: Do not place code cells at non-anchor cells within merged regions. If a cell is inside a merged region, use the anchor (top-left) cell of the merge instead.\n
`,
  },
  [AITool.SetFormulaCellValue]: {
    sources: ['AIAnalyst'],
    aiModelModes: ['disabled', 'fast', 'max', 'others'],
    description: `
Sets the value of one or more formula cells and runs them. Use the formulas array to set multiple different formulas in a single call, each with its own sheet, cell position, and formula string.\n
You should use the set_formula_cell_value function to set formula cell values. Use set_formula_cell_value function instead of responding with formulas.\n
Never use set_formula_cell_value function to set the value of a cell to a value that is not a formula. Don't add static data to the current open sheet using set_formula_cell_value function, use set_cell_values instead. set_formula_cell_value function is only meant to set the value of a cell to formulas.\n
Always refer to the data from cell by its position in a1 notation from respective sheet. Don't add values manually in formula cells.\n
Do not attempt to add formulas to data tables, it will result in an error.\n
This tool is for formulas only. For Python and Javascript code, use set_code_cell_value.\n
When using a range, cell references in the formula will automatically adjust relatively for each cell (like copy-paste in spreadsheets). Use $ for absolute references (e.g., $A$1) when you want references to stay fixed.\n
`,
    parameters: {
      type: 'object',
      properties: {
        formulas: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              sheet_name: {
                type: 'string',
                description: 'The sheet name of the sheet where the formula will be placed, as defined in the context',
              },
              code_cell_position: {
                type: 'string',
                description:
                  'The position of the formula cell(s) in a1 notation. This can be a single cell (e.g., "A1") or a range (e.g., "A1:A10") or a collection (e.g., "A1,A2:B2,A3").',
              },
              formula_string: {
                type: 'string',
                description:
                  'The formula which will run in the cell(s). If code_cell_position is a range or collection, cell references will adjust relatively for each cell (e.g., formula "A1" applied to range B1:B3 becomes "A1", "A2", "A3"). Use $ for absolute references (e.g., "$A$1" stays fixed for all cells).',
              },
            },
            required: ['sheet_name', 'code_cell_position', 'formula_string'],
            additionalProperties: false,
          },
        },
      },
      required: ['formulas'],
      additionalProperties: false,
    },
    responseSchema: codeToolsArgsSchemas[AITool.SetFormulaCellValue],
    prompt: `
You should use the set_formula_cell_value function to set formula cell values. Use set_formula_cell_value instead of responding with formulas.\n
Never use set_formula_cell_value function to set the value of a cell to a value that is not a formula. Don't add data to the current open sheet using set_formula_cell_value function, use set_cell_values instead. set_formula_cell_value function is only meant to set the value of a cell to a formula.\n
set_formula_cell_value function requires an array of formulas, each with a sheet_name, formula_string, and code_cell_position (single cell or range in a1 notation).\n
Always refer to the cells on sheet by its position in a1 notation. Don't add values manually in formula cells.\n
This tool is for formulas only. For Python and Javascript code, use set_code_cell_value.\n
Don't prefix formulas with \`=\` in formula cells.\n

Using the formulas array:\n
- You can set multiple different formulas at once by providing multiple objects in the formulas array.\n
- Each object requires a sheet_name, code_cell_position, and formula_string.\n
- Example: formulas: [{ sheet_name: "Sheet1", code_cell_position: "A1", formula_string: "SUM(B1:B10)" }, { sheet_name: "Sheet1", code_cell_position: "A2", formula_string: "AVERAGE(B1:B10)" }]\n

Multiple formula cells with relative referencing:\n
- Within each formula object, you can use a range for code_cell_position (e.g., "A1:A10") to apply the same formula pattern.\n
- Cell references in the formula will automatically adjust relatively for each cell, just like when you copy and paste a formula in a spreadsheet.\n
- Example: If you apply formula "SUM(A1)" to range B1:B3, it becomes "SUM(A1)" in B1, "SUM(A2)" in B2, and "SUM(A3)" in B3.\n
- To keep a reference fixed across all cells, use absolute references with $ (e.g., "$A$1" stays as "$A$1" in all cells).\n
- Mixed references are supported: "$A1" keeps column A fixed but row adjusts, "A$1" keeps row 1 fixed but column adjusts.\n

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
- Applying formulas to multiple cells with relative references (e.g., calculating percentages for a column of data)

IMPORTANT: Do not place formulas at non-anchor cells within merged regions. If a cell is inside a merged region, use the anchor (top-left) cell of the merge instead.\n
`,
  },
  [AITool.UpdateCodeCell]: {
    sources: ['AIAssistant'],
    aiModelModes: ['disabled', 'fast', 'max', 'others'],
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
    responseSchema: codeToolsArgsSchemas[AITool.UpdateCodeCell],
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
    aiModelModes: ['disabled', 'fast', 'max', 'others'],
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
    responseSchema: codeToolsArgsSchemas[AITool.CodeEditorCompletions],
    prompt: `
This tool provides inline completions for the code in the code cell you are currently editing, you are provided with the prefix and suffix of the cursor position in the code cell.\n
You should use this tool to provide inline completions for the code in the code cell you are currently editing.\n
Completion is the delta that will be inserted at the cursor position in the code cell.\n
`,
  },
  [AITool.RerunCode]: {
    sources: ['AIAnalyst'],
    aiModelModes: ['disabled', 'fast', 'max', 'others'],
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
          type: ['string', 'null'],
          description: 'The sheet name to rerun code in. If not provided, then it reruns all code cells in the file.',
        },
        selection: {
          type: ['string', 'null'],
          description:
            'The selection (in A1 notation) of code cells to rerun. If not provided, then it reruns all code cells in the sheet. For example, A1:D100',
        },
      },
      required: ['sheet_name', 'selection'],
      additionalProperties: false,
    },
    responseSchema: codeToolsArgsSchemas[AITool.RerunCode],
    prompt: `
This tool reruns the code in code cells.\n
You can optionally provide a sheet name and a selection (in A1 notation) to rerun specific code cells.\n
If you only provide a sheet name, then all code cells within that sheet will run.\n
If you provide a selection and sheet name, then only code cells within that selection will run.\n
If you provide neither a sheet name nor a selection, then all code cells in the file will run.\n
`,
  },
} as const;
