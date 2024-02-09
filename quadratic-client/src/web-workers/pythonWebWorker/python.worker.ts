/* eslint-disable no-restricted-globals */

import { InspectPythonReturnType, PythonMessage } from './pythonTypes';

const TRY_AGAIN_TIMEOUT = 500;

self.importScripts('/pyodide/pyodide.js');

let getCellsMessages: (cells: { x: number; y: number; value: string; type_name: string }[]) => void | undefined;

const getCellsDB = async (
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  sheet?: string,
  lineNumber?: number
): Promise<{ x: number; y: number; value: string; type_name: string }[]> => {
  return new Promise((resolve) => {
    getCellsMessages = (cells: { x: number; y: number; value: string; type_name: string }[]) => resolve(cells);
    self.postMessage({ type: 'get-cells', range: { x0, y0, x1, y1, sheet, lineNumber } } as PythonMessage);
  });
};

let pyodide: any | undefined;

async function pythonWebWorker() {
  try {
    self.postMessage({ type: 'not-loaded' } as PythonMessage);
    pyodide = await (self as any).loadPyodide();

    await pyodide.registerJsModule('getCellsDB', getCellsDB);
    await pyodide.loadPackage('micropip');

    let micropip = await pyodide.pyimport('micropip');

    // patch requests https://github.com/koenvo/pyodide-http
    await micropip.install(['pyodide-http']);
    await pyodide.runPythonAsync('import pyodide_http; pyodide_http.patch_all();');

    // load our python code
    await micropip.install('/quadratic_py-0.1.0-py3-none-any.whl');

    // make run_python easier to call later
    await pyodide.runPython('from quadratic_py.run_python import run_python');
    await pyodide.runPythonAsync('from quadratic_py.inspect_python import inspect_python');
  } catch (e) {
    self.postMessage({ type: 'python-error' } as PythonMessage);
    console.warn(`[Python WebWorker] failed to load`, e);
    setTimeout(() => pythonWebWorker(), TRY_AGAIN_TIMEOUT);
    return;
  }

  self.postMessage({ type: 'python-loaded' } as PythonMessage);
}

self.onmessage = async (e: MessageEvent<PythonMessage>) => {
  const event = e.data;

  if (event.type === 'get-cells') {
    if (event.cells && getCellsMessages) {
      getCellsMessages(event.cells);
    }
  } else if (event.type === 'inspect') {
    if (!pyodide) {
      self.postMessage({ type: 'not-loaded' } as PythonMessage);
    } else {
      if (event.python) {
        // TODO(ddimaria): is this still needed?
        const output = await inspectPython(event.python, pyodide);
        return self.postMessage({
          type: 'inspect-results',
          results: output,
          python_code: event.python,
        });
      }
    }
  } else if (event.type === 'execute') {
    // make sure loading is done
    if (!pyodide) {
      self.postMessage({ type: 'not-loaded' } as PythonMessage);
    } else {
      // auto load packages
      await pyodide.loadPackagesFromImports(event.python);

      let output, results;

      try {
        output = await pyodide.globals.get('run_python')(event.python);
        results = Object.fromEntries(output.toJs());

        return self.postMessage({
          type: 'results',
          results,
          python_code: event.python,
        });
      } catch (e) {
        // gracefully recover from deserialization errors
        console.warn(e);
        const error_results = {
          ...results,
          output_value: null,
          output_size: null,
          array_output: [],
          input_python_stack_trace: String(e),
          std_err: String(e),
          success: false,
        };
        return self.postMessage({
          type: 'results',
          results: error_results,
          python_code: event.python,
        });
      } finally {
        // destroy the output as it can cause memory leaks
        if (output) output.destroy();
      }
    }
  }
};

async function inspectPython(
  pythonCode: string,
  pyodide: any = undefined
): Promise<InspectPythonReturnType | undefined> {
  const output = await pyodide.globals.get('inspect_python')(pythonCode);

  if (output === undefined) {
    return undefined;
  }

  return Object.fromEntries(output.toJs()) as InspectPythonReturnType;
}

pythonWebWorker();
