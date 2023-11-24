import z from 'zod';
import { ArrayOutputSchema } from '../../schemas';

export const CellEvaluationResultSchema = z.object({
  success: z.boolean(),
  std_out: z.string().optional(),
  std_err: z.string().optional(),
  output_value: z.string().or(z.null()).or(z.undefined()),
  cells_accessed: z.tuple([z.number(), z.number()]).array(),
  array_output: ArrayOutputSchema,
  formatted_code: z.string(),
  error_span: z.tuple([z.number(), z.number()]).or(z.null()),
});

export type CellEvaluationResult = z.infer<typeof CellEvaluationResultSchema>;
