import { z } from 'zod';
import type { AIToolSpec } from '../aiToolsCore';
import { AITool, booleanNullableOptionalSchema } from '../aiToolsCore';

// Zod schemas for conditional format tools
export const conditionalFormatToolsArgsSchemas = {
  [AITool.GetConditionalFormats]: z.object({
    sheet_name: z.string(),
  }),
  [AITool.UpdateConditionalFormats]: z.object({
    sheet_name: z.string(),
    rules: z.array(
      z.object({
        id: z.string().uuid().nullable().optional(),
        action: z.enum(['create', 'update', 'delete']),
        selection: z.string().nullable().optional(),
        type: z.enum(['formula', 'color_scale']).nullable().optional(),
        rule: z.string().nullable().optional(),
        bold: booleanNullableOptionalSchema,
        italic: booleanNullableOptionalSchema,
        underline: booleanNullableOptionalSchema,
        strike_through: booleanNullableOptionalSchema,
        text_color: z.string().nullable().optional(),
        fill_color: z.string().nullable().optional(),
        apply_to_empty: booleanNullableOptionalSchema,
        color_scale_thresholds: z
          .array(
            z.object({
              value_type: z.enum(['min', 'max', 'number', 'percent', 'percentile']),
              value: z.number().nullable().optional(),
              color: z.string(),
            })
          )
          .nullable()
          .optional(),
        auto_contrast_text: booleanNullableOptionalSchema,
      })
    ),
  }),
} as const;

// Specs for conditional format tools
export const conditionalFormatToolsSpecs: { [K in keyof typeof conditionalFormatToolsArgsSchemas]: AIToolSpec } = {
  [AITool.GetConditionalFormats]: {
    sources: ['AIAnalyst'],
    aiModelModes: ['disabled', 'fast', 'max', 'others'],
    description: `
This tool gets all conditional formatting rules in a sheet.
Conditional formatting rules are per-sheet, so the sheet name is required.
Returns a list of all conditional format rules with their IDs, selections, rules, and styles.
Use this tool to understand what conditional formats already exist before creating, updating, or deleting them.`,
    parameters: {
      type: 'object',
      properties: {
        sheet_name: {
          type: 'string',
          description:
            'The sheet name to get conditional formats from. Required because conditional formats are per-sheet.',
        },
      },
      required: ['sheet_name'],
      additionalProperties: false,
    },
    responseSchema: conditionalFormatToolsArgsSchemas[AITool.GetConditionalFormats],
  },
  [AITool.UpdateConditionalFormats]: {
    sources: ['AIAnalyst'],
    aiModelModes: ['disabled', 'fast', 'max', 'others'],
    description: `
This tool creates, updates, or deletes conditional formatting rules in a sheet.
Supports two types of conditional formats:

Conditional formatting rules are per-sheet, so the sheet name is required.
IMPORTANT: When applying conditional formatting to table columns, ALWAYS use table column references (e.g., "Table_Name[Column Name]") instead of A1 ranges.
You can perform multiple operations (create/update/delete) in a single call.

## 1. FORMULA-BASED (type: "formula" or omitted)
Apply styles when a formula evaluates to true. Requires: selection, rule, and at least one style property.

Formula patterns:
- Greater than: "A1>100"
- Less than: "A1<50"
- Between: "AND(A1>=5, A1<=10)"
- Is empty: "ISBLANK(A1)"
- Is not empty: "NOT(ISBLANK(A1))"
- Text contains: "ISNUMBER(SEARCH(\\"text\\", A1))"
- Equals: "A1=42" or "A1=\\"exact text\\""

Example:
{
  "action": "create",
  "type": "formula",
  "selection": "A1:A100",
  "rule": "A1>100",
  "fill_color": "#FF0000",
  "bold": true
}

## 2. COLOR SCALE (type: "color_scale")
Apply gradient colors based on numeric cell values. Cells are colored on a gradient between threshold colors.

Threshold value_types:
- "min": Automatically uses the minimum value in the selection
- "max": Automatically uses the maximum value in the selection
- "number": Use a fixed numeric value (requires value field)
- "percent": Percent of the range, 0-100 (requires value field)
- "percentile": Percentile of values, 0-100 (requires value field)

Optional: "auto_contrast_text": true - Automatically switches text between black/white based on background darkness for readability.

Common color scale examples:
- Red to Green (2-color): min=#FF0000 (red), max=#00FF00 (green)
- Traffic Light (3-color): min=#FF0000 (red), 50th percentile=#FFFF00 (yellow), max=#00FF00 (green)
- Heat Map: min=#FFFFCC (light yellow), 50th percentile=#FD8D3C (orange), max=#800026 (dark red)
- Blue intensity: min=#DEEBF7 (light blue), max=#08519C (dark blue)

Example - 2-color scale (low=red, high=green):
{
  "action": "create",
  "type": "color_scale",
  "selection": "B1:B100",
  "color_scale_thresholds": [
    { "value_type": "min", "color": "#FF0000" },
    { "value_type": "max", "color": "#00FF00" }
  ],
  "auto_contrast_text": false
}

Example - 3-color scale with auto-contrast text:
{
  "action": "create",
  "type": "color_scale",
  "selection": "C1:C100",
  "color_scale_thresholds": [
    { "value_type": "min", "color": "#FF0000" },
    { "value_type": "percentile", "value": 50, "color": "#FFFF00" },
    { "value_type": "max", "color": "#00FF00" }
  ],
  "auto_contrast_text": true
}

For delete action, only the id is required.
For update action, id is required plus any fields you want to change.`,
    parameters: {
      type: 'object',
      properties: {
        sheet_name: {
          type: 'string',
          description:
            'The sheet name to update conditional formats in. Required because conditional formats are per-sheet.',
        },
        rules: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              id: {
                type: ['string', 'null'],
                description:
                  'The UUID of an existing conditional format. Required for update and delete actions. For create, leave null or omit.',
              },
              action: {
                type: 'string',
                description:
                  'The action to perform. Must be one of: "create" (new rule), "update" (modify existing rule), or "delete" (remove rule).',
              },
              type: {
                type: ['string', 'null'],
                description:
                  'The type of conditional format. "formula" (default) for formula-based rules with styles, or "color_scale" for gradient colors based on numeric values. If omitted, defaults to "formula".',
              },
              selection: {
                type: ['string', 'null'],
                description:
                  'The selection for the conditional format. IMPORTANT: When targeting table columns, ALWAYS use table column references (e.g., "Table_Name[Column Name]") instead of A1 ranges. For non-table data, use A1 notation (e.g., "A1:D10" or "A:A"). Required for create and update actions.',
              },
              rule: {
                type: ['string', 'null'],
                description:
                  'For formula-based formats only. A formula that evaluates to true/false for each cell. Examples: "A1>100", "ISBLANK(A1)", "AND(A1>=5, A1<=10)". Required for formula-based create/update actions.',
              },
              bold: {
                type: ['boolean', 'null'],
                description: 'For formula-based formats. Whether to apply bold formatting when the rule is true.',
              },
              italic: {
                type: ['boolean', 'null'],
                description: 'For formula-based formats. Whether to apply italic formatting when the rule is true.',
              },
              underline: {
                type: ['boolean', 'null'],
                description: 'For formula-based formats. Whether to apply underline formatting when the rule is true.',
              },
              strike_through: {
                type: ['boolean', 'null'],
                description:
                  'For formula-based formats. Whether to apply strikethrough formatting when the rule is true.',
              },
              text_color: {
                type: ['string', 'null'],
                description:
                  'For formula-based formats. The text color to apply when the rule is true (e.g., "#FF0000" for red).',
              },
              fill_color: {
                type: ['string', 'null'],
                description:
                  'For formula-based formats. The background/fill color to apply when the rule is true (e.g., "#00FF00" for green).',
              },
              apply_to_empty: {
                type: ['boolean', 'null'],
                description:
                  'Whether to apply the format to empty/blank cells. By default, this is false for numeric comparisons because empty cells coerce to 0.',
              },
              color_scale_thresholds: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    value_type: {
                      type: 'string',
                      description:
                        'How to determine the threshold value. "min" = minimum value in selection, "max" = maximum value, "number" = fixed numeric value, "percent" = percent of range (0-100), "percentile" = percentile of values (0-100).',
                    },
                    value: {
                      type: ['number', 'null'],
                      description:
                        'The numeric value for "number", "percent", or "percentile" value_types. Use null for "min" or "max".',
                    },
                    color: {
                      type: 'string',
                      description: 'The hex color at this threshold (e.g., "#FF0000" for red, "#00FF00" for green).',
                    },
                  },
                  required: ['value_type', 'value', 'color'],
                  additionalProperties: false,
                },
              },
              auto_contrast_text: {
                type: ['boolean', 'null'],
                description:
                  'For color scale formats only. When true, automatically switches text color between black and white based on the background color luminance to ensure readability. Useful when using dark colors in the scale.',
              },
            },
            // OpenAI strict mode requires all properties to be in `required` when
            // `additionalProperties: false`. Fields are made optional by using
            // nullable types (e.g., `type: ['string', 'null']`), allowing the AI
            // to pass `null` for fields that don't apply to the current action.
            required: [
              'id',
              'action',
              'type',
              'selection',
              'rule',
              'bold',
              'italic',
              'underline',
              'strike_through',
              'text_color',
              'fill_color',
              'apply_to_empty',
              'color_scale_thresholds',
              'auto_contrast_text',
            ],
            additionalProperties: false,
          },
        },
      },
      required: ['sheet_name', 'rules'],
      additionalProperties: false,
    },
    responseSchema: conditionalFormatToolsArgsSchemas[AITool.UpdateConditionalFormats],
  },
} as const;
