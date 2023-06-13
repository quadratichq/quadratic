import { ArrayOutput } from '../../../schemas';

export interface runPythonReturnType {
  cells_accessed: [number, number][];
  success: boolean;
  input_python_stack_trace: string;
  input_python_std_out: string;
  output_value: string | null;
  array_output: ArrayOutput;
  formatted_code: string;
}

export async function runPython(python_code: string, pyodide: any = undefined): Promise<runPythonReturnType> {
  // if pyodide is not passed in, try to get it from the global scope in the browser
  let pyodide_obj = pyodide;

  if (pyodide_obj === undefined) {
    if (typeof window !== 'undefined') {
      // Browser environment, get pyodide from window
      pyodide_obj = window.pyodide;
    }
  }

  if (pyodide_obj === undefined) {
    throw new Error('Pyodide not found');
  }

  const output = await pyodide_obj.globals.get('run_python')(python_code);

  return Object.fromEntries(output.toJs()) as runPythonReturnType;
}
