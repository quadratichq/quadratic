import { z } from 'zod';
import type { AIToolSpec } from '../aiToolsCore';
import { AITool, booleanSchema, numberSchema } from '../aiToolsCore';

// Zod schemas for row/column tools
export const rowColumnToolsArgsSchemas = {
  [AITool.ResizeColumns]: z.object({
    sheet_name: z.string().nullable().optional(),
    selection: z.string(),
    size: z.union([z.enum(['auto', 'default']), z.number().min(20).max(2000)]),
  }),
  [AITool.ResizeRows]: z.object({
    sheet_name: z.string().nullable().optional(),
    selection: z.string(),
    size: z.union([z.enum(['auto', 'default']), z.number().min(10).max(2000)]),
  }),
  [AITool.SetDefaultColumnWidth]: z.object({
    sheet_name: z.string().nullable().optional(),
    size: z.number().min(20).max(2000),
  }),
  [AITool.SetDefaultRowHeight]: z.object({
    sheet_name: z.string().nullable().optional(),
    size: z.number().min(10).max(2000),
  }),
  [AITool.InsertColumns]: z.object({
    sheet_name: z.string().nullable().optional(),
    column: z.string(),
    right: booleanSchema,
    count: numberSchema,
  }),
  [AITool.InsertRows]: z.object({
    sheet_name: z.string().nullable().optional(),
    row: numberSchema,
    below: booleanSchema,
    count: numberSchema,
  }),
  [AITool.DeleteColumns]: z.object({
    sheet_name: z.string().nullable().optional(),
    columns: z.array(z.string()),
  }),
  [AITool.DeleteRows]: z.object({
    sheet_name: z.string().nullable().optional(),
    rows: z.array(numberSchema),
  }),
} as const;

// Specs for row/column tools
export const rowColumnToolsSpecs: { [K in keyof typeof rowColumnToolsArgsSchemas]: AIToolSpec } = {
  [AITool.ResizeColumns]: {
    sources: ['AIAnalyst'],
    aiModelModes: ['disabled', 'fast', 'max', 'others'],
    description: `
This tool resizes specific columns in a sheet.\n
It requires the sheet name, a selection (in A1 notation) of columns to resize, and the size to resize to.\n
The selection is a range of columns, for example: A1:D1.\n
The size can be: "default" (reset to default width), "auto" (resize to fit the largest cell content), or a number in pixels (between 20 and 2000).\n
IMPORTANT: To change ALL columns in the sheet at once (for uniform grid or square cells), use the set_default_column_width tool instead.\n
Use this tool for resizing specific columns, auto-fitting content, or prettifying the sheet.\n
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
          description: 'The selection (in A1 notation) of columns to resize, for example: A1:D1',
        },
        size: {
          type: ['string', 'number'],
          description:
            'The size to resize the columns to. Either "default", "auto" (fit content), or a number in pixels (20-2000).',
        },
      },
      required: ['sheet_name', 'selection', 'size'],
      additionalProperties: false,
    },
    responseSchema: rowColumnToolsArgsSchemas[AITool.ResizeColumns],
  },
  [AITool.ResizeRows]: {
    sources: ['AIAnalyst'],
    aiModelModes: ['disabled', 'fast', 'max', 'others'],
    description: `
This tool resizes specific rows in a sheet.\n
It requires the sheet name, a selection (in A1 notation) of rows to resize, and the size to resize to.\n
The selection is a range of rows, for example: A1:A100.\n
The size can be: "default" (reset to default height), "auto" (resize to fit the largest cell content), or a number in pixels (between 10 and 2000).\n
IMPORTANT: To change ALL rows in the sheet at once (for uniform grid or square cells), use the set_default_row_height tool instead.\n
Use this tool for resizing specific rows, auto-fitting content, or adjusting row heights.\n
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
          description: 'The selection (in A1 notation) of rows to resize, for example: A1:A100',
        },
        size: {
          type: ['string', 'number'],
          description:
            'The size to resize the rows to. Either "default", "auto" (fit content), or a number in pixels (10-2000).',
        },
      },
      required: ['sheet_name', 'selection', 'size'],
      additionalProperties: false,
    },
    responseSchema: rowColumnToolsArgsSchemas[AITool.ResizeRows],
  },
  [AITool.SetDefaultColumnWidth]: {
    sources: ['AIAnalyst'],
    aiModelModes: ['disabled', 'fast', 'max', 'others'],
    description: `
This tool sets the default column width for an entire sheet, affecting all columns that don't have a custom width.\n
It requires the sheet name and a size in pixels (between 20 and 2000).\n
This is useful for making uniform grid cells across the entire sheet.\n
For a square grid, set the default column width equal to the default row height (e.g., both at 100 pixels).\n
Use this tool when the user asks to change the default column width, make all columns a certain width, create a square grid, or uniformly resize the grid.\n
`,
    parameters: {
      type: 'object',
      properties: {
        sheet_name: {
          type: 'string',
          description: 'The sheet name to set the default column width in',
        },
        size: {
          type: 'number',
          description:
            'The default column width in pixels (20-2000). Default is 100 pixels. For square cells, use the same value as the default row height.',
        },
      },
      required: ['sheet_name', 'size'],
      additionalProperties: false,
    },
    responseSchema: rowColumnToolsArgsSchemas[AITool.SetDefaultColumnWidth],
  },
  [AITool.SetDefaultRowHeight]: {
    sources: ['AIAnalyst'],
    aiModelModes: ['disabled', 'fast', 'max', 'others'],
    description: `
This tool sets the default row height for an entire sheet, affecting all rows that don't have a custom height.\n
It requires the sheet name and a size in pixels (between 10 and 2000).\n
This is useful for making uniform grid cells across the entire sheet.\n
For a square grid, set the default row height equal to the default column width (e.g., both at 100 pixels).\n
Use this tool when the user asks to change the default row height, make all rows a certain height, create a square grid, or uniformly resize the grid.\n
`,
    parameters: {
      type: 'object',
      properties: {
        sheet_name: {
          type: 'string',
          description: 'The sheet name to set the default row height in',
        },
        size: {
          type: 'number',
          description:
            'The default row height in pixels (10-2000). Default is 21 pixels. For square cells, use the same value as the default column width.',
        },
      },
      required: ['sheet_name', 'size'],
      additionalProperties: false,
    },
    responseSchema: rowColumnToolsArgsSchemas[AITool.SetDefaultRowHeight],
  },
  [AITool.InsertColumns]: {
    sources: ['AIAnalyst'],
    aiModelModes: ['disabled', 'fast', 'max', 'others'],
    description: `
This tool inserts columns in a sheet, adjusted columns to the right of the insertion. The new columns will share the formatting of the column provided.\n
It requires the sheet name, the column to insert the columns at, whether to insert to the right or left of the column, and the number of columns to insert.\n
`,
    parameters: {
      type: 'object',
      properties: {
        sheet_name: {
          type: 'string',
          description: 'The sheet name to insert columns in',
        },
        column: {
          type: 'string',
          description:
            'The column to insert the columns at. This must be a valid column name, for example A or ZA. The new columns will share the formatting of this column.',
        },
        right: {
          type: 'boolean',
          description:
            'Whether to insert to the right or left of the column. If true, insert to the right of the column. If false, insert to the left of the column.',
        },
        count: {
          type: 'number',
          description: 'The number of columns to insert',
        },
      },
      required: ['sheet_name', 'column', 'right', 'count'],
      additionalProperties: false,
    },
    responseSchema: rowColumnToolsArgsSchemas[AITool.InsertColumns],
  },
  [AITool.InsertRows]: {
    sources: ['AIAnalyst'],
    aiModelModes: ['disabled', 'fast', 'max', 'others'],
    description: `
This tool inserts rows in a sheet, adjusted rows below the insertion.\n
It requires the sheet name, the row to insert the rows at, whether to insert below or above the row, and the number of rows to insert. The new rows will share the formatting of the row provided.\n
`,
    parameters: {
      type: 'object',
      properties: {
        sheet_name: {
          type: 'string',
          description: 'The sheet name to insert rows in',
        },
        row: {
          type: 'number',
          description:
            'The row to insert the rows at. This should be a number, for example 1, 2, 35, etc. The new rows will share the formatting of this row.',
        },
        below: {
          type: 'boolean',
          description:
            'Whether to insert below or above the row. If true, insert below the row. If false, insert above the row.',
        },
        count: {
          type: 'number',
          description: 'The number of rows to insert',
        },
      },
      required: ['sheet_name', 'row', 'below', 'count'],
      additionalProperties: false,
    },
    responseSchema: rowColumnToolsArgsSchemas[AITool.InsertRows],
  },
  [AITool.DeleteColumns]: {
    sources: ['AIAnalyst'],
    aiModelModes: ['disabled', 'fast', 'max', 'others'],
    description: `
This tool deletes columns in a sheet, adjusting columns to the right of the deletion.\n
It requires the sheet name and an array of sheet columns to delete.\n
`,
    parameters: {
      type: 'object',
      properties: {
        sheet_name: {
          type: 'string',
          description: 'The sheet name to delete columns in',
        },
        columns: {
          type: 'array',
          items: {
            type: 'string',
            description: 'The column to delete. This must be a valid column name, for example "A" or "ZB".',
          },
        },
      },
      required: ['sheet_name', 'columns'],
      additionalProperties: false,
    },
    responseSchema: rowColumnToolsArgsSchemas[AITool.DeleteColumns],
  },
  [AITool.DeleteRows]: {
    sources: ['AIAnalyst'],
    aiModelModes: ['disabled', 'fast', 'max', 'others'],
    description: `
This tool deletes rows in a sheet, adjusting rows below the deletion.\n
It requires the sheet name and an array of sheet rows to delete.\n
`,
    parameters: {
      type: 'object',
      properties: {
        sheet_name: {
          type: 'string',
          description: 'The sheet name to delete rows in',
        },
        rows: {
          type: 'array',
          items: {
            type: 'number',
            description: 'The row to delete. This must be a number, for example 1, 2, 35, etc.',
          },
        },
      },
      required: ['sheet_name', 'rows'],
      additionalProperties: false,
    },
    responseSchema: rowColumnToolsArgsSchemas[AITool.DeleteRows],
  },
} as const;
