import { z } from 'zod';
import type { AIToolSpec } from '../aiToolsCore';
import { AITool, array2DSchema, numberSchema, stringNullableOptionalSchema, stringSchema } from '../aiToolsCore';

// Zod schemas for cell data tools
export const cellDataToolsArgsSchemas = {
  [AITool.AddDataTable]: z.object({
    sheet_name: stringSchema,
    top_left_position: stringSchema,
    table_name: stringSchema,
    table_data: array2DSchema,
  }),
  [AITool.SetCellValues]: z.object({
    sheet_name: stringNullableOptionalSchema,
    top_left_position: stringSchema,
    cell_values: array2DSchema,
  }),
  [AITool.GetCellData]: z.object({
    sheet_name: stringNullableOptionalSchema,
    selection: stringSchema,
    page: numberSchema,
  }),
  [AITool.HasCellData]: z.object({
    sheet_name: z.string().nullable().optional(),
    selection: z.string(),
  }),
  [AITool.MoveCells]: z.object({
    sheet_name: stringNullableOptionalSchema,
    source_selection_rect: stringSchema,
    target_top_left_position: stringSchema,
  }),
  [AITool.DeleteCells]: z.object({
    sheet_name: stringNullableOptionalSchema,
    selection: stringSchema,
  }),
} as const;

// Specs for cell data tools
export const cellDataToolsSpecs: { [K in keyof typeof cellDataToolsArgsSchemas]: AIToolSpec } = {
  [AITool.AddDataTable]: {
    sources: ['AIAnalyst', 'PDFImport'],
    aiModelModes: ['disabled', 'fast', 'max', 'others'],
    description: `
Adds a data table to the current sheet defined in the context, requires the sheet name, top_left_position (in a1 notation), the name of the data table and the data to add. The data should be a 2d array of strings, where each sub array represents a row of values.\n
top_left_position is the anchor position of the data table.\n
Do NOT use this tool if you want to convert existing data to a data table. Use convert_to_table instead.\n
The first row of the data table is considered to be the header row, and the data table will be created with the first row as the header row.\n
The added table on the sheet contains an extra row with the name of the data table. Always leave 2 rows of extra space on the bottom and 2 columns of extra space on the right when adding data tables on the sheet.\n
All rows in the 2d array of values should be of the same length. Use empty strings for missing values but always use the same number of columns for each row.\n
Data tables are best for adding new tabular data to the sheet. Do not use this tool for adding non-tabular data to the sheet or data that requires inputs like calculators. Use set_cell_values for that kind of task.\n
Don't use this tool to add data to a data table that already exists. Use set_cell_values function to add data to a data table that already exists.\n
All values can be referenced in the code cells immediately. Always refer to the cell by its position on respective sheet, in a1 notation. Don't add values manually in code cells.\n
To delete a data table, use set_cell_values function with the top_left_position of the data table and with just one empty string value at the top_left_position. Overwriting the top_left_position (anchor position) deletes the data table.\n
Don't attempt to add formulas or code to data tables.\n
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
    responseSchema: cellDataToolsArgsSchemas[AITool.AddDataTable],
  },
  [AITool.SetCellValues]: {
    sources: ['AIAnalyst'],
    aiModelModes: ['disabled', 'fast', 'max', 'others'],
    description: `
You should use the set_cell_values function to set the values of a sheet to a 2d array of strings.\n
Unless specifically requested, do NOT place cells over existing data on the sheet. You have enough information in the context to know where all cells are in the sheets.
Use this function to add data to a sheet. Don't use code cell for adding data. Always add data using this function.\n\n
When adding new data or information to the sheet, bias towards using this function instead of add_data_table, unless the data is clearly tabular data.\n
CRITICALLY IMPORTANT: you MUST insert column headers ABOVE the first row of data.\n
When setting cell values, follow these rules for headers:\n
1. The header row MUST be the first row in the cell_values array\n
2. The header row MUST contain column names that describe the data below\n
3. The header row MUST have the same number of columns as the data rows\n
4. The header row MUST be included in the cell_values array, not as a separate operation\n
5. The top_left_position MUST point to where the header row should start, which is usually the row above the first row of inserted data\n\n
This function requires the sheet name of the current sheet from the context, the top_left_position (in a1 notation) and the 2d array of strings representing the cell values to set. Values are string representation of text, number, logical, time instant, duration, error, html, code, image, date, time or blank.\n
top_left_position is the position of the top left corner of the 2d array of values on the current open sheet, in a1 notation. This should be a single cell, not a range. Each sub array represents a row of values.\n
Values set using this function will replace the existing values in the cell and can be referenced in the code cells immediately. Always refer to the cell by its position on respective sheet, in a1 notation. Don't add these in code cells.\n
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
    responseSchema: cellDataToolsArgsSchemas[AITool.SetCellValues],
  },
  [AITool.GetCellData]: {
    sources: ['AIAnalyst', 'AIAssistant'],
    aiModelModes: ['disabled', 'fast', 'max', 'others'],
    description: `
This tool returns the values of the cells in the chosen selection. The selection may be in the sheet or in a data table.\n
Use this tool to get the actual values of data on the sheet. For placement purposes, you MUST use the information in your context about where there is data on all the sheets.
Do NOT use this tool if there is no data based on the data bounds provided for the sheet, or if you already have the data in context.\n
You should use the get_cell_data function to get the values of the cells when you need more data for a successful reference.\n
Include the sheet name in both the selection and the sheet_name parameter. Use the current sheet name in the context unless the user is requesting data from another sheet, in which case use that sheet name.\n
get_cell_data function requires a string representation (in a1 notation) of a selection of cells to get the values of (e.g., "A1:B10", "TableName[Column 1]", or "Sheet2!D:D"), and the name of the current sheet.\n
The get_cell_data function may return page information. Use the page parameter to get the next page of results.\n
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
      required: ['sheet_name', 'selection', 'page'],
      additionalProperties: false,
    },
    responseSchema: cellDataToolsArgsSchemas[AITool.GetCellData],
  },
  [AITool.HasCellData]: {
    sources: ['AIAnalyst'],
    aiModelModes: [],
    description: `
This tool checks if any cells in the chosen selection have data. Returns true if ANY cell in the selection contains data.
You MUST use this tool before creating or moving tables, code, connections, or cells to avoid spilling cells over existing data.

Supported selection formats:
- Single cell: "A1"
- Range: "A1:B10" (checks entire range)
- Multiple ranges (comma-separated): "A1:B5, D1:E5, G10"
- Full columns: "A:C"
- Full rows: "1:5"
- Cross-sheet references: "Sheet2!A1:B10"
- Table references: "TableName[Column]"

Use this tool to check if a target area is empty before writing data to it.
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
          description: `The selection to check for data in A1 notation. Supports: single cell ("A1"), range ("A1:B10"), multiple comma-separated ranges ("A1:B5, D1:E5"), full columns/rows ("A:C", "1:5"), and cross-sheet references ("Sheet2!A1:B10").`,
        },
      },
      required: ['sheet_name', 'selection'],
      additionalProperties: false,
    },
    responseSchema: cellDataToolsArgsSchemas[AITool.HasCellData],
  },
  [AITool.MoveCells]: {
    sources: ['AIAnalyst'],
    aiModelModes: ['disabled', 'fast', 'max', 'others'],
    description: `
You should use the move_cells function to move a rectangular selection of cells from one location to another on the current open sheet.\n
You MUST use this tool to fix spill errors to move code, tables, or charts to a different location.\n
When moving a single spilled code cell, use the move tool to move just the single anchor cell of that code cell causing the spill.\n
move_cells function requires the current sheet name provided in the context, the source selection, and the target position. Source selection is the string representation (in a1 notation) of a selection rectangle to be moved.\n
When moving a table, leave a space between the table and any surrounding content. This is more aesthetic and easier to read.\n
Target position is the top left corner of the target position on the current open sheet, in a1 notation. This should be a single cell, not a range.\n
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
    responseSchema: cellDataToolsArgsSchemas[AITool.MoveCells],
  },
  [AITool.DeleteCells]: {
    sources: ['AIAnalyst'],
    aiModelModes: ['disabled', 'fast', 'max', 'others'],
    description: `
Deletes the value(s) of a selection of cells, requires a string representation of a selection of cells to delete. Selection can be a single cell or a range of cells or multiple ranges in a1 notation.\n
You should use the delete_cells function to delete the value(s) of a selection of cells in the sheet with sheet_name.\n
You MUST NOT delete cells or tables that are referenced by code cells unless the user explicitly asks you to. For example, if you write Python code that references cells, you MUST NOT delete the original cells or the Python code will stop working.\n
delete_cells functions requires the current sheet name provided in the context, and a string representation (in a1 notation) of a selection of cells to delete. Selection can be a single cell or a range of cells or multiple ranges in a1 notation.\n
You MUST use this tool to delete columns in tables by providing it with the column name in A1. For example, "TableName[Column Name]".
You MUST use this tool to delete tables by providing it with the table name in A1. For example, "TableName".
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
    responseSchema: cellDataToolsArgsSchemas[AITool.DeleteCells],
  },
} as const;
