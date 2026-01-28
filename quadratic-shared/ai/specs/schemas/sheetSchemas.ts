import { z } from 'zod';
import type { AIToolSpec } from '../aiToolsCore';
import { AITool } from '../aiToolsCore';

// Zod schemas for sheet tools
export const sheetToolsArgsSchemas = {
  [AITool.AddSheet]: z.object({
    sheet_name: z.string(),
    insert_before_sheet_name: z.string().nullable().optional(),
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
    insert_before_sheet_name: z.string().nullable().optional(),
  }),
  [AITool.ColorSheets]: z.object({
    sheet_names_to_color: z.array(
      z.object({
        sheet_name: z.string(),
        color: z.string(),
      })
    ),
  }),
} as const;

// Specs for sheet tools
export const sheetToolsSpecs: { [K in keyof typeof sheetToolsArgsSchemas]: AIToolSpec } = {
  [AITool.AddSheet]: {
    sources: ['AIAnalyst'],
    aiModelModes: ['disabled', 'fast', 'max', 'others'],
    description: `
This tool adds a new sheet in the file.\n
It requires the name of the new sheet, and an optional name of a sheet to insert the new sheet before.\n
This tool is meant to be used whenever users ask to create new sheets or ask to perform an analysis or task in a new sheet.\n
This tool should not be used to list the sheets in the file. The names of all sheets in the file are available in context.\n
`,
    parameters: {
      type: 'object',
      properties: {
        sheet_name: {
          type: 'string',
          description:
            'The new name of the sheet. This must be a unique name and cannot be more than 31 characters. It cannot contain any of the following characters: / \\ ? * : [ ].',
        },
        insert_before_sheet_name: {
          type: ['string', 'null'],
          description:
            'The name of a sheet to insert the new sheet before. If not provided, the new sheet will be added to the end of the sheet list.',
        },
      },
      required: ['sheet_name', 'insert_before_sheet_name'],
      additionalProperties: false,
    },
    responseSchema: sheetToolsArgsSchemas[AITool.AddSheet],
    prompt: `
This tool adds a new sheet in the file.\n
It requires the name of the new sheet, and an optional name of a sheet to insert the new sheet before.\n
This tool is meant to be used whenever users ask to create new sheets or ask to perform an analysis or task in a new sheet.\n
This tool should not be used to list the sheets in the file. The names of all sheets in the file are available in context.\n
`,
  },
  [AITool.DuplicateSheet]: {
    sources: ['AIAnalyst'],
    aiModelModes: ['disabled', 'fast', 'max', 'others'],
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
          description:
            'The new name of the sheet. This must be a unique name and cannot be more than 31 characters. It cannot contain any of the following characters: / \\ ? * : [ ].',
        },
      },
      required: ['sheet_name_to_duplicate', 'name_of_new_sheet'],
      additionalProperties: false,
    },
    responseSchema: sheetToolsArgsSchemas[AITool.DuplicateSheet],
    prompt: `
This tool duplicates a sheet in the file.\n
It requires the name of the sheet to duplicate and the name of the new sheet.\n
This tool should be used primarily when users explicitly ask to create a new sheet from the existing content or ask directly to copy or duplicate a sheet.\n
`,
  },
  [AITool.RenameSheet]: {
    sources: ['AIAnalyst'],
    aiModelModes: ['disabled', 'fast', 'max', 'others'],
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
          description:
            'The new name of the sheet. This must be a unique name and cannot be more than 31 characters. It cannot contain any of the following characters: / \\ ? * : [ ].',
        },
      },
      required: ['sheet_name', 'new_name'],
      additionalProperties: false,
    },
    responseSchema: sheetToolsArgsSchemas[AITool.RenameSheet],
    prompt: `
This tool renames a sheet in the file.\n
It requires the name of the sheet to rename and the new name. This must be a unique name.\n
`,
  },
  [AITool.DeleteSheet]: {
    sources: ['AIAnalyst'],
    aiModelModes: ['disabled', 'fast', 'max', 'others'],
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
    responseSchema: sheetToolsArgsSchemas[AITool.DeleteSheet],
    prompt: `
This tool deletes a sheet in the file.\n
It requires the name of the sheet to delete.\n
`,
  },
  [AITool.MoveSheet]: {
    sources: ['AIAnalyst'],
    aiModelModes: [],
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
          type: ['string', 'null'],
          description:
            'The name of a sheet to insert the moved sheet before. If not provided, the sheet will be added to the end of the sheet list.',
        },
      },
      required: ['sheet_name', 'insert_before_sheet_name'],
      additionalProperties: false,
    },
    responseSchema: sheetToolsArgsSchemas[AITool.MoveSheet],
    prompt: `
This tool moves a sheet in the sheet list.\n
It requires the name of the sheet to move and an optional name of a sheet to insert the sheet before. If no sheet name is provided, the sheet will be added to the end of the sheet list.\n
`,
  },
  [AITool.ColorSheets]: {
    sources: ['AIAnalyst'],
    aiModelModes: [],
    description: `
This tool colors the sheet tabs in the file.\n
It requires a array of objects with sheet names and new colors.\n
`,
    parameters: {
      type: 'object',
      properties: {
        sheet_names_to_color: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              sheet_name: {
                type: 'string',
                description: 'The name of the sheet to color',
              },
              color: {
                type: 'string',
                description: 'The new color of the sheet. This must be a valid CSS color string.',
              },
            },
            required: ['sheet_name', 'color'],
            additionalProperties: false,
          },
        },
      },
      required: ['sheet_names_to_color'],
      additionalProperties: false,
    },
    responseSchema: sheetToolsArgsSchemas[AITool.ColorSheets],
    prompt: `
This tool colors the sheet tabs in the file.\n
It requires a array of objects with sheet names and new colors.\n
`,
  },
} as const;
