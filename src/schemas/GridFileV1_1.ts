import z from 'zod';
import { GridFileV1 } from './GridFileV1';
import { v4 as uuid } from 'uuid';
import { DEFAULT_FILE_NAME } from '../constants/app';

// Shared schemas
const ArrayOutputSchema = z.array(z.union([z.string(), z.number(), z.boolean()]));
const BorderDirectionSchema = z.object({
  color: z.string().optional(),
  type: z.enum(['line1', 'line2', 'line3', 'dotted', 'dashed', 'double']).optional(),
});
const HeadingSchema = z.object({
  id: z.number(),
  size: z.number().optional(),
});

// File schema
export const GridFileSchemaV1_1 = z.object({
  borders: z
    .object({
      x: z.number(),
      y: z.number(),
      horizontal: BorderDirectionSchema.optional(),
      vertical: BorderDirectionSchema.optional(),
    })
    .array(),
  cells: z
    .object({
      x: z.number(),
      y: z.number(),
      type: z.enum(['TEXT', 'FORMULA', 'JAVASCRIPT', 'PYTHON', 'SQL', 'COMPUTED', 'AI']),
      value: z.string(),
      array_cells: z.tuple([z.number(), z.number()]).array().optional(), // list of output array cells created by this cell
      dependent_cells: z.tuple([z.number(), z.number()]).array().optional(),
      evaluation_result: z
        .object({
          success: z.boolean(),
          std_out: z.string().optional(),
          std_err: z.string().optional(),
          output_value: z.string().or(z.null()).or(z.undefined()),
          cells_accessed: z.tuple([z.number(), z.number()]).array(),
          array_output: z.union([ArrayOutputSchema, z.array(ArrayOutputSchema)]).optional(), // 1 or 2d array
          formatted_code: z.string(),
          error_span: z.tuple([z.number(), z.number()]).or(z.null()),
        })
        .optional(),
      formula_code: z.string().optional(),
      last_modified: z.string().optional(),
      ai_prompt: z.string().optional(),
      python_code: z.string().optional(),
    })
    .array(),
  cell_dependency: z.string(),
  columns: HeadingSchema.array(),
  created: z.number(),

  // Note: this is used inside the app, but is overridden when a file is
  // imported by either the file's name on disk or the name in the URL
  filename: z.string(),

  formats: z
    .object({
      x: z.number(),
      y: z.number(),
      alignment: z.enum(['right', 'center']).optional(), // default is left
      bold: z.boolean().optional(),
      fillColor: z.string().optional(),
      italic: z.boolean().optional(),
      textColor: z.string().optional(),
      textFormat: z
        .union([
          z.object({
            type: z.literal('NUMBER'),
            decimalPlaces: z.number().optional(),
          }),
          z.object({
            display: z.literal('CURRENCY'),
            type: z.literal('CURRENCY'),
            symbol: z.string().optional(),
            decimalPlaces: z.number().optional(),
          }),
          z.object({
            type: z.literal('PERCENTAGE'),
            decimalPlaces: z.number().optional(),
          }),
          z.object({
            type: z.literal('EXPONENTIAL'),
            decimalPlaces: z.number().optional(),
          }),
        ])
        .optional(),
      wrapping: z.enum(['wrap', 'clip']).optional(), // default is overflow
    })
    .array(),
  id: z.string().uuid(),
  modified: z.number(),

  // todo: this goes away when alignment branch is merged
  // because this goes away, we'll accept anything in runtime parsing
  render_dependency: z.any(), // Dependency[];

  rows: HeadingSchema.array(),
  version: z.literal('1.1'),
});
export type GridFileV1_1 = z.infer<typeof GridFileSchemaV1_1>;

/**
 * Given a v1 file, update it to a v1_1 file
 */
export function upgradeV1toV1_1(file: GridFileV1): GridFileV1_1 {
  const date = Date.now();

  // The previous enums for borders were integers but now we use strings
  // So we have to change them all, e.g. from "3" to "dotted"
  // https://github.com/quadratichq/quadratic/pull/308/files#diff-fb2ecd77a7c43aa1f68a862e8866d079391f51b6ae9665059d523221fdf5256fL44-R41
  const enumMapping = {
    0: 'line1',
    1: 'line2',
    2: 'line3',
    3: 'dotted',
    4: 'dashed',
    5: 'double',
  };

  return {
    ...file,
    borders: file.borders.map((oldBorder) => {
      // Make a deep copy, modify as necessary, and return it
      const border = JSON.parse(JSON.stringify(oldBorder));

      if (typeof border?.horizontal?.type === 'number') {
        // @ts-expect-error we know it exists
        border.horizontal.type = enumMapping[border.horizontal.type];
      }

      if (typeof border?.vertical?.type === 'number') {
        // @ts-expect-error we know it exists
        border.vertical.type = enumMapping[border.vertical.type];
      }
      return border;
    }),
    version: '1.1',
    modified: date,
    created: date,
    id: uuid(),
    filename: DEFAULT_FILE_NAME,
  } as GridFileV1_1;
}
