export interface runPythonReturnType {
  cells_accessed: [number, number][];
  input_python_evaluation_success: boolean;
  input_python_stack_trace: string;
  input_python_std_out: string;
  output_value: string | null;
  array_output: (string | number | boolean)[][];
  formatted_code: string;
}

export async function runPython(python_code: string): Promise<runPythonReturnType> {
  const output = await window.pyodide.globals.get('run_python')(python_code);

  return Object.fromEntries(output.toJs()) as runPythonReturnType;
}
