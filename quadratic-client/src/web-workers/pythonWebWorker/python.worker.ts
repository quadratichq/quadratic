/* eslint-disable no-restricted-globals */

import { InspectPythonReturnType, PythonMessage } from './pythonTypes';

const TRY_AGAIN_TIMEOUT = 500;

let pyodide: any | undefined;

try {
  self.importScripts('/pyodide/pyodide.js');
} catch (e) {
  // do nothing, we're in a test
}
let getCellsMessages: (cells: { x: number; y: number; value: string; type_name: string }[]) => void | undefined;
let getPosMessages: (cells: { x: number; y: number }[]) => void | undefined;

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

const getPos = async (): Promise<{ x: number; y: number }[]> => {
  return new Promise((resolve) => {
    getPosMessages = (cells: { x: number; y: number }[]) => resolve(cells);
    self.postMessage({ type: 'get-relative-cells' } as PythonMessage);
  });
};

async function pythonWebWorker() {
  try {
    self.postMessage({ type: 'not-loaded' } as PythonMessage);

    try {
      pyodide = await (self as any).loadPyodide();
    } catch (e) {
      // failed, we're in a test
      pyodide = await require('pyodide').loadPyodide({
        stdin: () => {},
        stdout: () => {},
        stderr: () => {},
      });
    }

    await pyodide.registerJsModule('getCellsDB', getCellsDB);
    await pyodide.registerJsModule('getPos', getPos);
    await pyodide.loadPackage('micropip');

    let micropip = await pyodide.pyimport('micropip');

    // patch requests https://github.com/koenvo/pyodide-http
    await micropip.install(['pyodide-http']);
    await pyodide.runPythonAsync('import pyodide_http; pyodide_http.patch_all();');

    // load our python code
    try {
      await micropip.install('/quadratic_py-0.1.0-py3-none-any.whl');
    } catch (e) {
      // failed, we're in a test
      await micropip.install('file:public/quadratic_py-0.1.0-py3-none-any.whl');
    }

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
  } else if (event.type === 'get-relative-cells') {
    if (event.cells && getPosMessages) {
      getPosMessages(event.cells);
    }
  } else if (event.type === 'inspect') {
    if (!pyodide) {
      self.postMessage({ type: 'not-loaded' } as PythonMessage);
    } else {
      if (event.python) {
        const output = await inspectPython(event.python, pyodide);

        return self.postMessage({
          type: 'inspect-results',
          results: output,
          python: event.python,
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

      let output, results, inspection_results;

      try {
        output = await pyodide.globals.get('run_python')(event.python);
        results = Object.fromEntries(output.toJs());
        inspection_results = await inspectPython(event.python || '', pyodide);

        return self.postMessage({
          type: 'results',
          results: {
            ...results,
            ...inspection_results,
          },
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
  if (!pyodide) {
    self.postMessage({ type: 'not-loaded' } as PythonMessage);
  } else {
    const output = await pyodide.globals.get('inspect_python')(pythonCode);

    if (output === undefined) {
      return undefined;
    }

    return Object.fromEntries(output.toJs()) as InspectPythonReturnType;
  }
}

pythonWebWorker();
