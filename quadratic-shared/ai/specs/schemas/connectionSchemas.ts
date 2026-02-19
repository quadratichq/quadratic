import { ConnectionTypeSchema } from 'quadratic-shared/typesAndSchemasConnections';
import { z } from 'zod';
import type { AIToolSpec } from '../aiToolsCore';
import { AITool } from '../aiToolsCore';

// Zod schemas for connection tools
export const connectionToolsArgsSchemas = {
  [AITool.GetDatabaseSchemas]: z.object({
    connection_ids: z
      .preprocess((val) => (val ? val : []), z.array(z.string().uuid()))
      .transform((val) => val.filter((id) => !!id)),
  }),
  [AITool.SetSQLCodeCellValue]: z.object({
    sheet_name: z.string().nullable().optional(),
    code_cell_name: z.string(),
    connection_kind: z
      .string()
      .transform((val) => val.toUpperCase())
      .pipe(ConnectionTypeSchema),
    code_cell_position: z.string(),
    sql_code_string: z.string(),
    connection_id: z.string().uuid(),
  }),
} as const;

// Specs for connection tools
export const connectionToolsSpecs: { [K in keyof typeof connectionToolsArgsSchemas]: AIToolSpec } = {
  [AITool.GetDatabaseSchemas]: {
    sources: ['AIAnalyst'],
    aiModelModes: ['disabled', 'fast', 'max', 'others'],
    description: `
Retrieves detailed database table schemas including column names, data types, and constraints.\n
Use this tool every time you want to write SQL. You need the table schema to write accurate queries.\n
If connection_ids is an empty array, it will return detailed schemas for all available team connections.\n
This tool should always be called before writing SQL. If you don't have the table schema, you cannot write accurate SQL queries.\n
`,
    parameters: {
      type: 'object',
      properties: {
        connection_ids: {
          type: 'array',
          items: {
            type: 'string',
            description:
              'UUID string corresponding to the connection ID of the SQL Connection for which you want to get the schemas.',
          },
        },
      },
      required: ['connection_ids'],
      additionalProperties: false,
    },
    responseSchema: connectionToolsArgsSchemas[AITool.GetDatabaseSchemas],
  },
  [AITool.SetSQLCodeCellValue]: {
    sources: ['AIAnalyst'],
    aiModelModes: ['disabled', 'fast', 'max', 'others'],
    description: `
Adds or updates a SQL Connection code cell and runs it in the 'sheet_name' sheet. Requires the connection_kind, connection_id, cell position (in A1 notation), and code string.\n
Output of the code cell is a table. Provide a name for the output table of the code cell. The name cannot contain spaces or special characters, but _ is allowed.\n
Note: only name the code cell if it is new.\n
Do not attempt to add code to data tables, it will result in an error. Use set_cell_values or add_data_table to add data to the sheet.\n
This tool is for SQL Connection code only. For Python and Javascript use set_code_cell_value. For Formulas, use set_formula_cell_value.\n\n

IMPORTANT: if you've already created a table and user wants to make subsequent queries on that same table, use the existing code cell instead of creating a new query.

For SQL Connection code cells:\n
- Use the Connection ID (uuid) and Connection language: POSTGRES, MYSQL, MSSQL, SNOWFLAKE, BIGQUERY, COCKROACHDB, MARIADB, SUPABASE, NEON or MIXPANEL.\n
- The Connection ID must be from an available database connection in the team.\n
- Use the GetDatabaseSchemas tool to get the database schemas before writing SQL queries.\n
- Write SQL queries that reference the database tables and schemas provided in context.\n

SQL code cell placement instructions:\n
- The code cell location should be empty and positioned such that it will not overlap other cells. If there is an existing value in a single cell where the code result is supposed to go, it will result in spill error. Use current open sheet context to identify empty space.\n
- If the sheet is empty, place the code cell at A1.\n
- Use the existing SQL cell location if editing existing SQL code cell. Queries that are on a table that already exists in the sheet should be edits to existing code tables, not new tables unless the user specifically asks for a new table.\n
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
        connection_kind: {
          type: 'string',
          description:
            'The kind of the sql code cell, this can be one of POSTGRES, MYSQL, MSSQL, SNOWFLAKE, BIGQUERY, COCKROACHDB, MARIADB, SUPABASE, NEON or MIXPANEL.',
        },
        code_cell_position: {
          type: 'string',
          description:
            'The position of the code cell in the current open sheet, in a1 notation. This should be a single cell, not a range.',
        },
        sql_code_string: {
          type: 'string',
          description: 'The code which will run in the cell',
        },
        connection_id: {
          type: 'string',
          description:
            'This is uuid string corresponding to the connection ID of the SQL Connection code cell. There can be multiple connections in the team, so this is required to identify the connection along with the language.',
        },
      },
      required: [
        'sheet_name',
        'code_cell_name',
        'connection_kind',
        'code_cell_position',
        'sql_code_string',
        'connection_id',
      ],
      additionalProperties: false,
    },
    responseSchema: connectionToolsArgsSchemas[AITool.SetSQLCodeCellValue],
  },
} as const;
