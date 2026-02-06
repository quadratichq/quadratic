import { z } from 'zod';
import type { AIToolSpec } from '../aiToolsCore';
import {
  AITool,
  booleanSchema,
  numberSchema,
  validationMessageErrorPrompt,
  validationMessageErrorSchema,
} from '../aiToolsCore';

// Zod schemas for validation tools
export const validationToolsArgsSchemas = {
  [AITool.GetValidations]: z.object({
    sheet_name: z.string().nullable().optional(),
  }),
  [AITool.AddMessage]: z.object({
    sheet_name: z.string().nullable().optional(),
    selection: z.string(),
    message_title: z.string().nullable().optional(),
    message_text: z.string().nullable().optional(),
  }),
  [AITool.AddLogicalValidation]: z
    .object({
      sheet_name: z.string().nullable().optional(),
      selection: z.string(),
      show_checkbox: booleanSchema.nullable().optional(),
      ignore_blank: booleanSchema.nullable().optional(),
    })
    .merge(validationMessageErrorSchema),
  [AITool.AddListValidation]: z
    .object({
      sheet_name: z.string().nullable().optional(),
      selection: z.string(),
      ignore_blank: booleanSchema.nullable().optional(),
      drop_down: booleanSchema.nullable().optional(),
      list_source_list: z.string().nullable().optional(),
      list_source_selection: z.string().nullable().optional(),
    })
    .merge(validationMessageErrorSchema),
  [AITool.AddTextValidation]: z
    .object({
      sheet_name: z.string().nullable().optional(),
      selection: z.string(),
      ignore_blank: booleanSchema.nullable().optional(),
      max_length: numberSchema.nullable().optional(),
      min_length: numberSchema.nullable().optional(),
      contains_case_sensitive: z.string().nullable().optional(),
      contains_case_insensitive: z.string().nullable().optional(),
      not_contains_case_sensitive: z.string().nullable().optional(),
      not_contains_case_insensitive: z.string().nullable().optional(),
      exactly_case_sensitive: z.string().nullable().optional(),
      exactly_case_insensitive: z.string().nullable().optional(),
    })
    .merge(validationMessageErrorSchema),
  [AITool.AddNumberValidation]: z
    .object({
      sheet_name: z.string().nullable().optional(),
      selection: z.string(),
      ignore_blank: booleanSchema.nullable().optional(),
      range: z.string().nullable().optional(),
      equal: z.string().nullable().optional(),
      not_equal: z.string().nullable().optional(),
    })
    .merge(validationMessageErrorSchema),
  [AITool.AddDateTimeValidation]: z
    .object({
      sheet_name: z.string().nullable().optional(),
      selection: z.string(),
      ignore_blank: booleanSchema.nullable().optional(),
      date_range: z.string().nullable().optional(),
      date_equal: z.string().nullable().optional(),
      date_not_equal: z.string().nullable().optional(),
      time_range: z.string().nullable().optional(),
      time_equal: z.string().nullable().optional(),
      time_not_equal: z.string().nullable().optional(),
      require_date: booleanSchema.nullable().optional(),
      require_time: booleanSchema.nullable().optional(),
      prohibit_date: booleanSchema.nullable().optional(),
      prohibit_time: booleanSchema.nullable().optional(),
    })
    .merge(validationMessageErrorSchema),
  [AITool.RemoveValidations]: z.object({
    sheet_name: z.string().nullable().optional(),
    selection: z.string(),
  }),
} as const;

// Specs for validation tools
export const validationToolsSpecs: { [K in keyof typeof validationToolsArgsSchemas]: AIToolSpec } = {
  [AITool.GetValidations]: {
    sources: ['AIAnalyst'],
    aiModelModes: ['disabled', 'fast', 'max', 'others'],
    description: `
This tool gets the validations in a sheet.\n
It requires the sheet name.\n
`,
    parameters: {
      type: 'object',
      properties: {
        sheet_name: {
          type: 'string',
          description: 'The sheet name to get the validations in',
        },
      },
      required: ['sheet_name'],
      additionalProperties: false,
    },
    responseSchema: validationToolsArgsSchemas[AITool.GetValidations],
  },
  [AITool.AddMessage]: {
    sources: ['AIAnalyst'],
    aiModelModes: ['disabled', 'fast', 'max', 'others'],
    description: `
This tool adds a message to a sheet using validations.\n`,
    parameters: {
      type: 'object',
      properties: {
        sheet_name: {
          type: 'string',
          description: 'The sheet name to add the message to',
        },
        selection: {
          type: 'string',
          description:
            'The selection of cells to add the message to. This must be in A1 notation, for example: A1:D1 or TableName[Column 1]',
        },
        message_title: {
          type: 'string',
          description: 'The title of the message to add',
        },
        message_text: {
          type: 'string',
          description: 'The text of the message to add',
        },
      },
      required: ['sheet_name', 'selection', 'message_title', 'message_text'],
      additionalProperties: false,
    },
    responseSchema: validationToolsArgsSchemas[AITool.AddMessage],
  },
  [AITool.AddLogicalValidation]: {
    sources: ['AIAnalyst'],
    aiModelModes: ['disabled', 'fast', 'max', 'others'],
    description: `
This tool adds a logical validation to a sheet. This also can display a checkbox in a cell to allow the user to toggle the cell between true and false.\n`,
    parameters: {
      type: 'object',
      properties: {
        sheet_name: {
          type: 'string',
          description: 'The sheet name to add the logical validation to',
        },
        selection: {
          type: 'string',
          description:
            'The selection of cells to add the logical validation to. This must be in A1 notation, for example: A1:D1 or TableName[Column 1]',
        },
        show_checkbox: {
          type: ['boolean', 'null'],
          description:
            'Whether to show a checkbox in the cell to allow the user to toggle the cell between true and false. This defaults to false.',
        },
        ignore_blank: {
          type: ['boolean', 'null'],
          description: 'Whether to ignore blank cells when validating. This defaults to true.',
        },
        ...validationMessageErrorPrompt,
      },
      required: [
        'sheet_name',
        'selection',
        'show_checkbox',
        'ignore_blank',
        ...Object.keys(validationMessageErrorPrompt),
      ],
      additionalProperties: false,
    },
    responseSchema: validationToolsArgsSchemas[AITool.AddLogicalValidation],
  },
  [AITool.AddListValidation]: {
    sources: ['AIAnalyst'],
    aiModelModes: ['disabled', 'fast', 'max', 'others'],
    description: `
This tool adds a list validation to a sheet. This can be used to limit the values that can be entered into a cell to a list of values.\n
The list should have either a list_source_list or a list_source_selection, but not both.\n`,
    parameters: {
      type: 'object',
      properties: {
        sheet_name: {
          type: 'string',
          description: 'The sheet name to add the list validation to',
        },
        selection: {
          type: 'string',
          description:
            'The selection of cells to add the list validation to. This must be in A1 notation, for example: A1:D1 or TableName[Column 1]',
        },
        ignore_blank: {
          type: ['boolean', 'null'],
          description: 'Whether to ignore blank cells when validating. This defaults to true.',
        },
        drop_down: {
          type: 'boolean',
          description: 'Whether to show a drop down list of values in the cell. This defaults to false.',
        },
        list_source_list: {
          type: ['string', 'null'],
          description:
            'The value to add to the list validation. The items should be in a list format separated by commas, for example: "Item 1, Item 2, Item 3". This defaults to null.',
        },
        list_source_selection: {
          type: ['string', 'null'],
          description:
            'The selection of cells to add to the list validation. This must be in A1 notation, for example: A1:D1 or TableName[Column 1]. This defaults to null.',
        },
        ...validationMessageErrorPrompt,
      },
      required: [
        'sheet_name',
        'selection',
        'ignore_blank',
        'drop_down',
        'list_source_list',
        'list_source_selection',
        ...Object.keys(validationMessageErrorPrompt),
      ],
      additionalProperties: false,
    },
    responseSchema: validationToolsArgsSchemas[AITool.AddListValidation],
  },
  [AITool.AddTextValidation]: {
    sources: ['AIAnalyst'],
    aiModelModes: ['disabled', 'fast', 'max', 'others'],
    description: `
This tool adds a text validation to a sheet. This validates a text string to ensure it meets certain criteria.\n`,
    parameters: {
      type: 'object',
      properties: {
        sheet_name: {
          type: 'string',
          description: 'The sheet name to add the text validation to',
        },
        selection: {
          type: 'string',
          description:
            'The selection of cells to add the text validation to. This must be in A1 notation, for example: A1:D1 or TableName[Column 1]',
        },
        ignore_blank: {
          type: ['boolean', 'null'],
          description: 'Whether to ignore blank cells when validating. This defaults to true.',
        },
        max_length: {
          type: ['number', 'null'],
          description: 'The maximum length of the text. This defaults to null.',
        },
        min_length: {
          type: ['number', 'null'],
          description: 'The minimum length of the text. This defaults to null.',
        },
        contains_case_sensitive: {
          type: ['string', 'null'],
          description:
            'The text to check if the cell contains it. This can be text or items separated by commas. The list is case sensitive. This defaults to null.',
        },
        contains_case_insensitive: {
          type: ['string', 'null'],
          description:
            'The text to check if the cell contains it. This can be text or items separated by commas. The list is case insensitive. This defaults to null.',
        },
        not_contains_case_sensitive: {
          type: ['string', 'null'],
          description:
            'The text to check if the cell does not contain it. This can be text or items separated by commas. The list is case sensitive. This defaults to null.',
        },
        not_contains_case_insensitive: {
          type: ['string', 'null'],
          description:
            'The text to check if the cell does not contain it. This can be text or items separated by commas. The list is case insensitive. This defaults to null.',
        },
        exactly_case_sensitive: {
          type: ['string', 'null'],
          description:
            'The text to check if the cell exactly matches it. This can be text or items separated by commas. The list is case sensitive. This defaults to null.',
        },
        exactly_case_insensitive: {
          type: ['string', 'null'],
          description:
            'The text to check if the cell exactly matches it. This can be text or items separated by commas. The list is case insensitive. This defaults to null.',
        },
        ...validationMessageErrorPrompt,
      },
      required: [
        'sheet_name',
        'selection',
        'ignore_blank',
        'max_length',
        'min_length',
        'contains_case_sensitive',
        'contains_case_insensitive',
        'not_contains_case_sensitive',
        'not_contains_case_insensitive',
        'exactly_case_sensitive',
        'exactly_case_insensitive',
        ...Object.keys(validationMessageErrorPrompt),
      ],
      additionalProperties: false,
    },
    responseSchema: validationToolsArgsSchemas[AITool.AddTextValidation],
  },
  [AITool.AddNumberValidation]: {
    sources: ['AIAnalyst'],
    aiModelModes: ['disabled', 'fast', 'max', 'others'],
    description: `
This tool adds a number validation to a sheet. This validates a number to ensure it meets certain criteria.\n`,
    parameters: {
      type: 'object',
      properties: {
        sheet_name: {
          type: 'string',
          description: 'The sheet name to add the number validation to',
        },
        selection: {
          type: 'string',
          description:
            'The selection of cells to add the number validation to. This must be in A1 notation, for example: A1:D1 or TableName[Column 1]',
        },
        ignore_blank: {
          type: ['boolean', 'null'],
          description: 'Whether to ignore blank cells when validating. This defaults to true.',
        },
        range: {
          type: ['string', 'null'],
          description:
            'A list of ranges of numbers. For example: "5..10,2..20,30..,..2". Each range is separated by a comma and must contain "..". You can leave the start or end blank to indicate no minimum or maximum. This defaults to null.',
        },
        equal: {
          type: ['string', 'null'],
          description:
            'A list of numbers that the cell must be equal to. This must be a list of numbers separated by commas. This defaults to null.',
        },
        not_equal: {
          type: ['string', 'null'],
          description:
            'A list of numbers that the cell must not be equal to. This must be a list of numbers separated by commas. This defaults to null.',
        },
        ...validationMessageErrorPrompt,
      },
      required: [
        'sheet_name',
        'selection',
        'ignore_blank',
        'range',
        'equal',
        'not_equal',
        ...Object.keys(validationMessageErrorPrompt),
      ],
      additionalProperties: false,
    },
    responseSchema: validationToolsArgsSchemas[AITool.AddNumberValidation],
  },
  [AITool.AddDateTimeValidation]: {
    sources: ['AIAnalyst'],
    aiModelModes: ['disabled', 'fast', 'max', 'others'],
    description: `
This tool adds a date time validation to a sheet. This validates a date time to ensure it meets certain criteria.\n`,
    parameters: {
      type: 'object',
      properties: {
        sheet_name: {
          type: 'string',
          description: 'The sheet name to add the date time validation to',
        },
        selection: {
          type: 'string',
          description:
            'The selection of cells to add the date time validation to. This must be in A1 notation, for example: A1:D1 or TableName[Column 1]',
        },
        ignore_blank: {
          type: ['boolean', 'null'],
          description: 'Whether to ignore blank cells when validating. This defaults to true.',
        },
        require_date: {
          type: ['boolean', 'null'],
          description: 'Whether the cell must be a date. This defaults to false.',
        },
        require_time: {
          type: ['boolean', 'null'],
          description: 'Whether the cell must be a time. This defaults to false.',
        },
        prohibit_date: {
          type: ['boolean', 'null'],
          description: 'Whether the cell must not be a date. This defaults to false.',
        },
        prohibit_time: {
          type: ['boolean', 'null'],
          description: 'Whether the cell must not be a time. This defaults to false.',
        },
        date_range: {
          type: ['string', 'null'],
          description:
            'A list of ranges of dates. Use YYYY/MM/DD or YYYY-MM-DD HH:MM:SS. For example: "2025/01/01..2025/01/31,2025/02/01 11:10:10..2025/02/28 05:00:00,2025/12/31 13:12:11..,..2025/02/01". Use ".." to create a range. You can leave the start or end blank to indicate no minimum or maximum. This defaults to null.',
        },
        time_range: {
          type: ['string', 'null'],
          description:
            'A list of ranges of times. For example: "10:00..12:00,14:00..16:00,18:00..,..10:00". Use ".." to create a range. You can leave the start or end blank to indicate no minimum or maximum. This defaults to null.',
        },
        date_equal: {
          type: ['string', 'null'],
          description:
            'A list of dates that the cell must be equal to. Use YYYY/MM/DD or YYYY-MM-DD HH:MM:SS. This must be a list of dates separated by commas. This defaults to null.',
        },
        date_not_equal: {
          type: ['string', 'null'],
          description:
            'A list of dates that the cell must not be equal to. Use YYYY/MM/DD or YYYY-MM-DD HH:MM:SS. This must be a list of dates separated by commas. This defaults to null.',
        },
        time_equal: {
          type: ['string', 'null'],
          description:
            'A list of times that the cell must be equal to. Use HH:MM:SS. This must be a list of times separated by commas. This defaults to null.',
        },
        time_not_equal: {
          type: ['string', 'null'],
          description:
            'A list of times that the cell must not be equal to. Use HH:MM:SS. This must be a list of times separated by commas. This defaults to null.',
        },
        ...validationMessageErrorPrompt,
      },
      required: [
        'sheet_name',
        'selection',
        'ignore_blank',
        'require_date',
        'require_time',
        'prohibit_date',
        'prohibit_time',
        'date_range',
        'time_range',
        'date_equal',
        'date_not_equal',
        'time_equal',
        'time_not_equal',
        ...Object.keys(validationMessageErrorPrompt),
      ],
      additionalProperties: false,
    },
    responseSchema: validationToolsArgsSchemas[AITool.AddDateTimeValidation],
  },
  [AITool.RemoveValidations]: {
    sources: ['AIAnalyst'],
    aiModelModes: ['disabled', 'fast', 'max', 'others'],
    description: `
This tool removes all validations in a sheet from a range.\n`,
    parameters: {
      type: 'object',
      properties: {
        sheet_name: {
          type: 'string',
          description: 'The sheet name to remove the validations from',
        },
        selection: {
          type: 'string',
          description:
            'The selection of cells to remove the validations from. This must be in A1 notation, for example: A1:D1 or TableName[Column 1]. All validations in this range will be removed.',
        },
      },
      required: ['sheet_name', 'selection'],
      additionalProperties: false,
    },
    responseSchema: validationToolsArgsSchemas[AITool.RemoveValidations],
  },
} as const;
