import z from 'zod';
import { GridFileV1_2 } from './GridFileV1_2';

// Shared schemas
const ArrayOutputBaseSchema = z.array(z.any());
const BorderDirectionSchema = z.object({
  color: z.string().optional(),
  type: z.enum(['line1', 'line2', 'line3', 'dotted', 'dashed', 'double']).optional(),
});
const HeadingSchema = z.object({
  id: z.number(),
  size: z.number().optional(),
});

// File schema
export const GridFileSchemaV1_3 = z.object({
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
          array_output: z.union([ArrayOutputBaseSchema, z.array(ArrayOutputBaseSchema)]).optional(), // 1 or 2d array
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
  formats: z
    .object({
      x: z.number(),
      y: z.number(),
      alignment: z.enum(['left', 'right', 'center']).optional(),
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
  rows: HeadingSchema.array(),
  version: z.literal('1.3'),
});
export type GridFileV1_3 = z.infer<typeof GridFileSchemaV1_3>;
export type ArrayOutputBase = z.infer<typeof ArrayOutputBaseSchema>;

/**
 * Given a v1_2 file, update it to a v1_3 file
 */
export function upgradeV1_2toV1_3(file: GridFileV1_2): GridFileV1_3 {
  // File meta information was removed from the file and added as column
  // information in the database. This includes:
  // `filename` - removed from file, renamed to `name` in db
  // `id` - removed from file, renamed to `uuid` in db
  // `created` - removed from file, renamed to `created_date` in db
  // `modified` - removed from file, renamed to `updated_date` in db
  const { filename, created, modified, id, ...rest } = file;

  const result: GridFileV1_3 = {
    ...rest,
    version: '1.3',
  };

  return result;
}
