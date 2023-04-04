import { CellEvaluationResultSchema } from '../computations/types';
import { CellTextFormatSchema } from '../formatting/cellTextFormat';
import z from 'zod';

const CellTypesSchema = z.enum(['TEXT', 'FORMULA', 'JAVASCRIPT', 'PYTHON', 'SQL', 'COMPUTED']);
export type CellTypes = z.infer<typeof CellTypesSchema>;

export const CellSchema = z.object({
  x: z.number(),
  y: z.number(),
  type: CellTypesSchema,
  value: z.string(),
  array_cells: z.tuple([z.number(), z.number()]).array().optional(), // list of output array cells created by this cell
  dependent_cells: z.tuple([z.number(), z.number()]).array().optional(),
  evaluation_result: CellEvaluationResultSchema.optional(),
  formula_code: z.string().optional(),
  last_modified: z.string().optional(),
  python_code: z.string().optional(),
});
export type Cell = z.infer<typeof CellSchema>;

export interface Heading {
  id: number;
  size?: number;
}

export const CellFormatSchema = z.object({
  x: z.number(),
  y: z.number(),
  alignment: z.enum(['right', 'center']).optional(), // default is left
  bold: z.boolean().optional(),
  fillColor: z.string().optional(),
  italic: z.boolean().optional(),
  textColor: z.string().optional(),
  textFormat: CellTextFormatSchema.optional(),
  wrapping: z.enum(['wrap', 'clip']).optional(), // default is overflow
});
export type CellFormat = z.infer<typeof CellFormatSchema>;

export const BorderTypeEnum = z.enum(['line1', 'line2', 'line3', 'dotted', 'dashed', 'double']);
export type BorderType = z.infer<typeof BorderTypeEnum>;

const BorderDirectionSchema = z.object({
  color: z.string().optional(),
  type: BorderTypeEnum.optional(),
});
export type BorderDirection = z.infer<typeof BorderDirectionSchema>;

/** starts at the top-left corner: horizontal goes to the top-right corner; vertical goes to the bottom-left corner */
export const BorderSchema = z.object({
  x: z.number(),
  y: z.number(),
  horizontal: BorderDirectionSchema.optional(),
  vertical: BorderDirectionSchema.optional(),
});
export type Border = z.infer<typeof BorderSchema>;
