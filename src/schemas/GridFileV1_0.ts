import z from 'zod';

const ArrayOutputSchema = z.array(z.any());

export enum BorderType {
  line1 = 0,
  line2 = 1,
  line3 = 2,
  dotted = 3,
  dashed = 4,
  double = 5,
}
const BorderDirectionSchema = z.object({
  color: z.string().optional(),
  type: z.nativeEnum(BorderType).optional(),
});

const CoordinateSchema = z.object({
  x: z.number(),
  y: z.number(),
});

const HeadingSchema = z.object({
  id: z.number(),
  size: z.number().optional(),
});

export const GridFileSchemaV1_0 = z.object({
  borders: z
    .object({
      x: z.number(),
      y: z.number(),
      horizontal: BorderDirectionSchema.optional(),
      vertical: BorderDirectionSchema.optional(),
    })
    .array()
    .optional(),
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
    .array()
    .optional(),
  cell_dependency: z.string().optional(),
  columns: HeadingSchema.array().optional(),
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
    .array()
    .optional(),
  render_dependency: z
    .object({
      location: CoordinateSchema,
      needToRender: CoordinateSchema.array(), // these are cells that must be rendered when drawing this cell
      renderThisCell: CoordinateSchema.array(), // these are cells that render this cell when drawing
    })
    .array()
    .optional(),
  rows: HeadingSchema.array().optional(),
  version: z.literal('1.0'),
});
export type GridFileV1_0 = z.infer<typeof GridFileSchemaV1_0>;
