export async function runPython(python_code: string) {
  const output = await window.pyodide.globals.get("run_python")(python_code);
  return output;
}
