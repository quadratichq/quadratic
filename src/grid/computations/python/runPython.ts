import { getPyodide } from './getPyodide';
export interface runPythonReturnType {
  cells_accessed: [number, number][];
  success: boolean;
  input_python_stack_trace: string;
  input_python_std_out: string;
  input_python_std_err: string;
  output_value: string | null;
  output_type: string;
  array_output: (string | number | boolean)[][];
  formatted_code: string;
}

export async function runPython(python_code: string, pyodide: any = undefined): Promise<runPythonReturnType> {
  // if pyodide is not passed in, try to get it from the global scope in the browser
  const pyodide_obj = getPyodide(pyodide);

  const output = await pyodide_obj.globals.get('run_python')(python_code);

  const output_obj = Object.fromEntries(output.toJs()) as runPythonReturnType;

  console.log('output_obj', output_obj);

  return output_obj;
}
