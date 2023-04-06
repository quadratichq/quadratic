import z from 'zod';

const ArrayOutputSchema = z.array(z.union([z.string(), z.number(), z.boolean()]));

export const CellEvaluationResultSchema = z.object({
  success: z.boolean(),
  std_out: z.string().optional(),
  std_err: z.string().optional(),
  output_value: z.string().or(z.null()).or(z.undefined()),
  cells_accessed: z.tuple([z.number(), z.number()]).array(),
  array_output: z.union([ArrayOutputSchema, z.array(ArrayOutputSchema)]).optional(), // 1 or 2d array
  formatted_code: z.string(),
  error_span: z.tuple([z.number(), z.number()]).or(z.null()),
});

export type ArrayOutput = z.infer<typeof ArrayOutputSchema>;
export type CellEvaluationResult = z.infer<typeof CellEvaluationResultSchema>;
