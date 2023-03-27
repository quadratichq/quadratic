export interface cellEvaluationReturnType {
  success: boolean;
  std_out?: string;
  std_err?: string;
  output_value: string | null;
  output_type: string | null;
  cells_accessed: [number, number][];
  array_output: (string | number | boolean)[][];
  formatted_code: string;
  error_span: [number, number] | null;
}
