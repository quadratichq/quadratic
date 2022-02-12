import { runPythonReturnType } from "./types";

export async function runPython(
  python_code: string
): Promise<runPythonReturnType> {
  const output = await window.pyodide.globals.get("run_python")(python_code);

  return Object.fromEntries(output.toJs()) as runPythonReturnType;
}
