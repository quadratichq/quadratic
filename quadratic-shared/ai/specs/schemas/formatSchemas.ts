import { z } from 'zod';
import type { AIToolSpec } from '../aiToolsCore';
import {
  AITool,
  booleanNullableOptionalSchema,
  numberSchema,
  stringNullableOptionalSchema,
  stringSchema,
} from '../aiToolsCore';

// Zod schemas for format tools
export const formatToolsArgsSchemas = {
  [AITool.SetTextFormats]: z.object({
    formats: z
      .array(
        z.object({
          sheet_name: stringNullableOptionalSchema,
          selection: stringSchema,
          bold: booleanNullableOptionalSchema,
          italic: booleanNullableOptionalSchema,
          underline: booleanNullableOptionalSchema,
          strike_through: booleanNullableOptionalSchema,
          text_color: stringNullableOptionalSchema,
          fill_color: stringNullableOptionalSchema,
          align: stringNullableOptionalSchema,
          vertical_align: stringNullableOptionalSchema,
          wrap: stringNullableOptionalSchema,
          numeric_commas: booleanNullableOptionalSchema,
          number_type: stringNullableOptionalSchema,
          currency_symbol: stringNullableOptionalSchema,
          date_time: stringNullableOptionalSchema,
          font_size: z.number().nullable().optional(),
        })
      )
      .min(1),
  }),
  [AITool.GetTextFormats]: z.object({
    sheet_name: stringNullableOptionalSchema,
    selection: stringSchema,
    page: numberSchema,
  }),
  [AITool.SetBorders]: z.object({
    sheet_name: z.string().nullable().optional(),
    selection: z.string(),
    color: z.string(),
    line: z
      .string()
      .transform((val) => val.toLowerCase())
      .pipe(z.enum(['line1', 'line2', 'line3', 'dotted', 'dashed', 'double', 'clear'])),
    border_selection: z
      .string()
      .transform((val) => val.toLowerCase())
      .pipe(z.enum(['all', 'inner', 'outer', 'horizontal', 'vertical', 'left', 'top', 'right', 'bottom', 'clear'])),
  }),
  [AITool.MergeCells]: z.object({
    sheet_name: z.string().nullable().optional(),
    selection: z.string(),
  }),
  [AITool.UnmergeCells]: z.object({
    sheet_name: z.string().nullable().optional(),
    selection: z.string(),
  }),
} as const;

// Specs for format tools
export const formatToolsSpecs: { [K in keyof typeof formatToolsArgsSchemas]: AIToolSpec } = {
  [AITool.SetTextFormats]: {
    sources: ['AIAnalyst'],
    aiModelModes: ['disabled', 'fast', 'max', 'others'],
    description: `
This tool sets the text formats of one or more selections of cells. Use the formats array to apply different formatting to multiple selections in a single call.\n
Each format entry requires a selection and at least one format property to set.\n
IMPORTANT: When formatting table columns, ALWAYS use table column references like "Table_Name[Column Name]" instead of A1 ranges like "A2:A2000", column references like "A", or infinite ranges like "A3:A". This ensures formatting applies correctly as the table grows or shrinks.\n
Here are the formats you can set in each entry:\n
- bold, italics, underline, or strike through\n
- text color and fill color using hex format, for example, #FF0000 for red. To remove colors, set to an empty string.\n
- horizontal alignment, this can be one of "left", "center", "right"\n
- vertical alignment, this can be one of "top", "middle", "bottom"\n
- wrapping, this can be one of "wrap", "clip", "overflow"\n
- numeric_commas, adds or removes commas from numbers\n
- number_type, this can be one of "number", "currency", "percentage", or "exponential". If "currency" is set, you MUST set the currency_symbol.\n
- currency_symbol, if number_type is "currency", use this to set the currency symbol, for example "$" for USD or "€" for EUR\n
- date_time, formats a date time value using Rust's chrono::format, e.g., "%Y-%m-%d %H:%M:%S", "%d/%m/%Y"\n
- font_size, the size of the font in points (default is 10)\n
To clear/remove a format, set the value to null (or empty string for colors). Omit fields you don't want to change.\n
Percentages in Quadratic work the same as in any spreadsheet. E.g. formatting .01 as a percentage will show as 1%. Formatting 1 as a percentage will show 100%.\n
Example: To bold A1:B5 and make C1:D5 italic with red text, use: { "formats": [{ "selection": "A1:B5", "bold": true }, { "selection": "C1:D5", "italic": true, "text_color": "#FF0000" }] }\n
Example: To format an entire table column as currency, use: { "formats": [{ "selection": "Sales_Data[Revenue]", "number_type": "currency", "currency_symbol": "$" }] }\n
You MAY want to use the get_text_formats function if you need to check the current text formats of the cells before setting them.\n
`,
    parameters: {
      type: 'object',
      properties: {
        formats: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              sheet_name: {
                type: 'string',
                description: 'The sheet name of the current sheet as defined in the context',
              },
              selection: {
                type: 'string',
                description: `The selection of cells to set the formats of. IMPORTANT: When formatting table columns, ALWAYS use table column references (e.g., "Table_Name[Column Name]") instead of A1 ranges like "A2:A2000", column references like "A", or infinite ranges like "A3:A". Use "Table1" for entire tables, "Table1[Column]" for single columns, or "Table1[[Col1]:[Col3]]" for column ranges. Only use A1 notation for non-table data. When formatting multiple non-contiguous cells, use comma-separated ranges (e.g., "A1,B2:D5,E20").`,
              },
              bold: {
                type: ['boolean', 'null'],
                description: 'Whether to set the cell to bold. Set to null to remove bold formatting.',
              },
              italic: {
                type: ['boolean', 'null'],
                description: 'Whether to set the cell to italic. Set to null to remove italic formatting.',
              },
              underline: {
                type: ['boolean', 'null'],
                description: 'Whether to set the cell to underline. Set to null to remove underline formatting.',
              },
              strike_through: {
                type: ['boolean', 'null'],
                description:
                  'Whether to set the cell to strike through. Set to null to remove strike through formatting.',
              },
              text_color: {
                type: ['string', 'null'],
                description:
                  'The color of the text, in hex format. To remove the text color, set the value to an empty string.',
              },
              fill_color: {
                type: ['string', 'null'],
                description:
                  'The color of the background, in hex format. To remove the fill color, set the value to an empty string.',
              },
              align: {
                type: ['string', 'null'],
                description:
                  'The horizontal alignment of the text, this can be one of "left", "center", "right". Set to null to remove alignment formatting.',
              },
              vertical_align: {
                type: ['string', 'null'],
                description:
                  'The vertical alignment of the text, this can be one of "top", "middle", "bottom". Set to null to remove vertical alignment formatting.',
              },
              wrap: {
                type: ['string', 'null'],
                description:
                  'The wrapping of the text, this can be one of "wrap", "clip", "overflow". Set to null to remove wrap formatting.',
              },
              numeric_commas: {
                type: ['boolean', 'null'],
                description:
                  'For numbers larger than three digits, whether to show commas. If true, then numbers will be formatted with commas. Set to null to remove comma formatting.',
              },
              number_type: {
                type: ['string', 'null'],
                description:
                  'The type for the numbers, this can be one of "number", "currency", "percentage", or "exponential". If "currency" is set, you MUST set the currency_symbol. Set to null to remove number type formatting.',
              },
              currency_symbol: {
                type: ['string', 'null'],
                description:
                  'If number_type is "currency", use this to set the currency symbol, for example "$" for USD or "€" for EUR. Set to null to remove currency symbol.',
              },
              date_time: {
                type: ['string', 'null'],
                description:
                  'formats a date time value using Rust\'s chrono::format, e.g., "%Y-%m-%d %H:%M:%S", "%d/%m/%Y". Set to null to remove date/time formatting.',
              },
              font_size: {
                type: ['number', 'null'],
                description:
                  'The font size in points. Default is 10. Set to a number to change the font size (e.g., 16). Set to null to remove font size formatting.',
              },
            },
            required: [
              'sheet_name',
              'selection',
              'bold',
              'italic',
              'underline',
              'strike_through',
              'text_color',
              'fill_color',
              'align',
              'vertical_align',
              'wrap',
              'numeric_commas',
              'number_type',
              'currency_symbol',
              'date_time',
              'font_size',
            ],
            additionalProperties: false,
          },
        },
      },
      required: ['formats'],
      additionalProperties: false,
    },
    responseSchema: formatToolsArgsSchemas[AITool.SetTextFormats],
  },
  [AITool.GetTextFormats]: {
    sources: ['AIAnalyst'],
    aiModelModes: ['disabled', 'fast', 'max', 'others'],
    description: `
This tool returns the text formatting information of a selection of cells on a specified sheet, requires the sheet name, the selection of cells to get the formats of.\n
When checking formats on table columns, use table column references (e.g., "Table_Name[Column Name]") instead of A1 ranges, column references like "A", or infinite ranges like "A3:A".\n
Do NOT use this tool if there is no formatting in the region based on the format bounds provided for the sheet.\n
It should be used to find formatting within a sheet's formatting bounds.\n
It returns a string representation of the formatting information of the cells in the selection.\n
If too large, the results will include page information:\n
- If page information is provided, perform actions on the current page's results before requesting the next page of results.\n
- Always review all pages of results; as you get each page, immediately perform any actions before moving to the next page.\n
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
            'The selection of cells to get the formats of. When targeting table columns, use table column references (e.g., "Table_Name[Column Name]") instead of A1 ranges, column references like "A", or infinite ranges like "A3:A". For non-table data, use A1 notation.',
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
    responseSchema: formatToolsArgsSchemas[AITool.GetTextFormats],
  },
  [AITool.SetBorders]: {
    sources: ['AIAnalyst'],
    aiModelModes: ['disabled', 'fast', 'max', 'others'],
    description: `
This tool sets the borders in a sheet.\n
It requires the sheet name, a selection (in A1 notation) of cells to set the borders on, and the color, line type, and border_selection of the borders.\n
The selection is a range of cells, for example: A1:D1.\n
The color must be a valid CSS color string.\n
The line type must be one of: line1, line2, line3, dotted, dashed, double, clear.\n
The border_selection must be one of: all, inner, outer, horizontal, vertical, left, top, right, bottom, clear.\n
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
It must be one of the following: line1, line2, line3, dotted, dashed, double, clear.\n
"line1" is a thin line.\n
"line2" is a thicker line.\n
"line3" is the thickest line.\n
"dotted" is a dotted line.\n
"dashed" is a dashed line.\n
"double" is a doubled line.\n
"clear" will remove all borders in selection.`,
        },
        border_selection: {
          type: 'string',
          description: `
The border selection to set the borders on. This must be one of the following: all, inner, outer, horizontal, vertical, left, top, right, bottom, clear.\n
"all" will set borders on all cells in the selection.\n
"inner" will set borders on the inside of the selection box.\n
"outer" will set borders on the outside of the selection box.\n
"horizontal" will set borders on the horizontal sides of the selection box.\n
"vertical" will set borders on the vertical sides of the selection box.\n
"left" will set borders on the left side of the selection box.\n
"top" will set borders on the top side of the selection box.\n
"right" will set borders on the right side of the selection box.\n
"bottom" will set borders on the bottom side of the selection box.\n
"clear" will remove all borders in selection.`,
        },
      },
      required: ['sheet_name', 'selection', 'color', 'line', 'border_selection'],
      additionalProperties: false,
    },
    responseSchema: formatToolsArgsSchemas[AITool.SetBorders],
  },
  [AITool.MergeCells]: {
    sources: ['AIAnalyst'],
    aiModelModes: ['disabled', 'fast', 'max', 'others'],
    description: `
This tool merges cells in a sheet.\n
It requires the sheet name and a selection (in A1 notation) of cells to merge.\n
The selection must be a range of cells (not a single cell), for example: A1:D1.\n
When cells are merged, all cell values except the top-left cell will be cleared, and the merged cell will display the value from the top-left cell.\n
`,
    parameters: {
      type: 'object',
      properties: {
        sheet_name: {
          type: 'string',
          description: 'The sheet name to merge cells in',
        },
        selection: {
          type: 'string',
          description:
            'The selection (in A1 notation) of cells to merge. This must be a range of cells, for example: A1:D1. Cannot be a single cell.',
        },
      },
      required: ['sheet_name', 'selection'],
      additionalProperties: false,
    },
    responseSchema: formatToolsArgsSchemas[AITool.MergeCells],
  },
  [AITool.UnmergeCells]: {
    sources: ['AIAnalyst'],
    aiModelModes: ['disabled', 'fast', 'max', 'others'],
    description: `
This tool unmerges cells in a sheet.\n
It requires the sheet name and a selection (in A1 notation) that contains merged cells to unmerge.\n
The selection can be a single cell or a range of cells, for example: A1 or A1:D1.\n
All merged cells that overlap with the selection will be unmerged, splitting them back into individual cells.\n
`,
    parameters: {
      type: 'object',
      properties: {
        sheet_name: {
          type: 'string',
          description: 'The sheet name to unmerge cells in',
        },
        selection: {
          type: 'string',
          description:
            'The selection (in A1 notation) that contains merged cells to unmerge. This can be a single cell or a range of cells, for example: A1 or A1:D1. All merged cells that overlap with this selection will be unmerged.',
        },
      },
      required: ['sheet_name', 'selection'],
      additionalProperties: false,
    },
    responseSchema: formatToolsArgsSchemas[AITool.UnmergeCells],
  },
} as const;
