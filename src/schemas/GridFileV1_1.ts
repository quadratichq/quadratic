import z from 'zod';

const ArrayOutputSchema = z.array(z.union([z.string(), z.number(), z.boolean()]));
const BorderDirectionSchema = z.object({
  color: z.string().optional(),
  type: z.enum(['line1', 'line2', 'line3', 'dotted', 'dashed', 'double']).optional(),
});
const HeadingSchema = z.object({
  id: z.number(),
  size: z.number().optional(),
});

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
      type: z.enum(['TEXT', 'FORMULA', 'JAVASCRIPT', 'PYTHON', 'SQL', 'COMPUTED']),
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
