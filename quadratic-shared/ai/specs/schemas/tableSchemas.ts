import { z } from 'zod';
import type { AIToolSpec } from '../aiToolsCore';
import { AITool, booleanSchema, stringNullableOptionalSchema, stringSchema } from '../aiToolsCore';

// Zod schemas for table tools
export const tableToolsArgsSchemas = {
  [AITool.ConvertToTable]: z.object({
    sheet_name: stringNullableOptionalSchema,
    selection: stringSchema,
    table_name: stringSchema,
    first_row_is_column_names: booleanSchema,
  }),
  [AITool.TableMeta]: z.object({
    sheet_name: z.string().nullable().optional(),
    table_location: z.string(),
    new_table_name: z.string().nullable().optional(),
    first_row_is_column_names: booleanSchema.nullable().optional(),
    show_name: booleanSchema.nullable().optional(),
    show_columns: booleanSchema.nullable().optional(),
    alternating_row_colors: booleanSchema.nullable().optional(),
  }),
  [AITool.TableColumnSettings]: z.object({
    sheet_name: z.string().nullable().optional(),
    table_location: z.string(),
    column_names: z.array(
      z.object({
        old_name: z.string(),
        new_name: z.string(),
        show: booleanSchema,
      })
    ),
  }),
} as const;

// Specs for table tools
export const tableToolsSpecs: { [K in keyof typeof tableToolsArgsSchemas]: AIToolSpec } = {
  [AITool.ConvertToTable]: {
    sources: ['AIAnalyst'],
    aiModelModes: ['disabled', 'fast', 'max', 'others'],
    description: `
This tool converts a selection of cells on a specified sheet into a data table.\n
IMPORTANT: the selection can NOT contain any code cells or data tables.\n
It requires the sheet name, a rectangular selection of cells to convert to a data table, the name of the data table and whether the first row is the column names.\n
A data table cannot be created over any existing code cells or data tables.\n
The data table will be created with the first row as the header row if first_row_is_column_names is true, otherwise the first row will be the first row of the data.\n
The data table will include a table name as the first row, which will push down all data by one row. Example: if the data previously occupied A1:A6, it now occupies A1:A7 since adding the table name shifted the data down by one row.\n
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
    responseSchema: tableToolsArgsSchemas[AITool.ConvertToTable],
  },
  [AITool.TableMeta]: {
    sources: ['AIAnalyst'],
    aiModelModes: ['disabled', 'fast', 'max', 'others'],
    description: `
This tool sets the meta data for a table. One or more options can be changed on the table at once.\n
`,
    parameters: {
      type: 'object',
      properties: {
        sheet_name: {
          type: 'string',
          description: 'The sheet name that contains the table',
        },
        table_location: {
          type: 'string',
          description: 'The anchor location of the table (ie, the top-left cell of the table). For example: A5',
        },
        new_table_name: {
          type: ['string', 'null'],
          description: 'The optional new name of the table.',
        },
        first_row_is_column_names: {
          type: ['boolean', 'null'],
          description:
            'The optional boolean as to whether the first row of the table contains the column names. If set to true, the first row will be used as the column names for the table. If set to false, default column names will be used instead.',
        },
        show_name: {
          type: ['boolean', 'null'],
          description:
            'The optional boolean that toggles whether the table name is shown for the table. This is true by default. If true, then the top row of the table only contains the table name.',
        },
        show_columns: {
          type: ['boolean', 'null'],
          description:
            'The optional boolean that toggles whether the column names are shown for the table. This is true by default. If true, then the first row of the table contains the column names.',
        },
        alternating_row_colors: {
          type: ['boolean', 'null'],
          description:
            'The optional boolean that toggles whether the table has alternating row colors. This is true by default. If true, then the table will have alternating row colors.',
        },
      },
      required: [
        'sheet_name',
        'table_location',
        'new_table_name',
        'first_row_is_column_names',
        'show_name',
        'show_columns',
        'alternating_row_colors',
      ],
      additionalProperties: false,
    },
    responseSchema: tableToolsArgsSchemas[AITool.TableMeta],
  },
  [AITool.TableColumnSettings]: {
    sources: ['AIAnalyst'],
    aiModelModes: ['disabled', 'fast', 'max', 'others'],
    description: `
This tool changes the columns of a table. It can rename them or show or hide them.\n
Use the delete_cells tool to delete columns by providing it with the column name. For example, "TableName[Column Name]". Don't hide the column unless the user requests it.
In the parameters, include only columns that you want to change. The remaining columns will remain the same.\n`,
    parameters: {
      type: 'object',
      properties: {
        sheet_name: {
          type: 'string',
          description: 'The sheet name that contains the table',
        },
        table_location: {
          type: 'string',
          description: 'The anchor location of the table (ie, the top-left cell of the table). For example: A5',
        },
        column_names: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              old_name: {
                type: 'string',
                description: 'The old name of the column',
              },
              new_name: {
                type: 'string',
                description:
                  'The new name of the column. If the new name is the same as the old name, the column will not be renamed.',
              },
              show: {
                type: 'boolean',
                description: 'Whether the column is shown in the table. This is true by default.',
              },
            },
            required: ['old_name', 'new_name', 'show'],
            additionalProperties: false,
          },
        },
      },
      required: ['sheet_name', 'table_location', 'column_names'],
      additionalProperties: false,
    },
    responseSchema: tableToolsArgsSchemas[AITool.TableColumnSettings],
  },
} as const;
