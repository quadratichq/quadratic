import { getPyodide } from './getPyodide';

export interface inspectPythonReturnType {
  lineno: number;
  col_offset: number;
  end_lineno: number;
  end_col_offset: number;
  value_type?: string;
}

export async function inspectPython(python_code: string, pyodide: any = undefined) {
  // if pyodide is not passed in, try to get it from the global scope in the browser
  const pyodide_obj = getPyodide(pyodide);

  const output = await pyodide_obj.globals.get('inspect_python')(python_code);

  if (output === undefined) {
    return undefined;
  }

  const output_obj = Object.fromEntries(output.toJs()) as inspectPythonReturnType;

  return output_obj;
}
