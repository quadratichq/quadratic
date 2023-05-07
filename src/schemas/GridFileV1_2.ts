import z from 'zod';
import { GridFileV1_1 } from './GridFileV1_1';

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
export const GridFileSchemaV1_2 = z.object({
  sheets: z
    .object({
      name: z.string(),
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

      rows: HeadingSchema.array(),
    })
    .array(),
  created: z.number(),

  // Note: this is used inside the app, but is overridden when a file is
  // imported by either the file's name on disk or the name in the URL
  filename: z.string(),

  id: z.string().uuid(),
  modified: z.number(),
  version: z.literal('1.2'),
});
export type GridFileV1_2 = z.infer<typeof GridFileSchemaV1_2>;

/**
 * Given a v1_1 file, update it to a v1_2 file
 */
export function upgradeV1_1toV1_2(file: GridFileV1_1): GridFileV1_2 {
  // file.render_dependency is removed
  return {
    sheets: [
      {
        name: 'Sheet1',
        borders: file.borders,
        cells: file.cells,
        cell_dependency: file.cell_dependency,
        columns: file.columns,
        rows: file.rows,
        formats: file.formats,
      },
    ],
    filename: file.filename,
    created: file.created,
    modified: file.modified,
    id: file.id,
    version: '1.2',
  } as GridFileV1_2;
}
