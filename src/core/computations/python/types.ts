export interface runPythonReturnType {
  cells_accessed: [number, number][];
  input_python_evaluation_success: boolean;
  input_python_stack_trace: string;
  input_python_std_out: string;
  output_value: string | null;
  formatted_code: string;
}
