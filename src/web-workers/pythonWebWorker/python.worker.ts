/* eslint-disable no-restricted-globals */
/* eslint-disable no-undef */

import inspect_python from '../../grid/computations/python/inspect_python.py';
import { Cell } from '../../schemas';
import { InspectPythonReturnType, PythonMessage, PythonReturnType } from './pythonTypes';
import define_run_python from './run_python.py';

const TRY_AGAIN_TIMEOUT = 500;

self.importScripts('/pyodide/pyodide.js');

let getCellsMessages: (cells: Cell[]) => void | undefined;

// eslint-disable-next-line @typescript-eslint/no-unused-vars
const getCellsDB = async (x0: number, y0: number, x1: number, y1: number): Promise<Cell[]> => {
  return new Promise((resolve) => {
    getCellsMessages = (cells: Cell[]) => resolve(cells);
    self.postMessage({ type: 'get-cells', range: { x0, y0, x1, y1 } } as PythonMessage);
  });
};

let pyodide: any | undefined;

async function pythonWebWorker() {
  try {
    pyodide = await (self as any).loadPyodide();
    await pyodide.registerJsModule('GetCellsDB', getCellsDB);
    await pyodide.loadPackage(['numpy', 'pandas', 'micropip']);
    await pyodide.runPython(await (await fetch(define_run_python)).text());
    await pyodide.runPython(await (await fetch(inspect_python)).text());
  } catch (e) {
    self.postMessage({ type: 'python-error' } as PythonMessage);
    console.warn(`[Python WebWorker] failed to load`, e);
    setTimeout(() => pythonWebWorker(), TRY_AGAIN_TIMEOUT);
    return;
  }

  console.log('[Python WebWorker] Initiated');
  self.postMessage({ type: 'python-loaded' } as PythonMessage);
}

self.onmessage = async (e: MessageEvent<PythonMessage>) => {
  const event = e.data;
  switch (event.type) {
    case 'get-cells': {
      if (event.cells && getCellsMessages) getCellsMessages(event.cells);
      break;
    }
    case 'execute': {
      // make sure loading is done
      if (!pyodide) return self.postMessage({ type: 'not-loaded' } as PythonMessage);

      const output = await pyodide.globals.get('run_python')(event.python);
      return self.postMessage({
        type: 'results',
        results: Object.fromEntries(output.toJs()) as PythonReturnType,
      } as PythonMessage);
    }
    case 'inspect-python': {
      if (!pyodide) return self.postMessage({ type: 'not-loaded' } as PythonMessage);
      const output = await pyodide.globals.get('inspect_python')(event.python);
      return self.postMessage({
        type: 'results',
        results: output !== undefined ? (Object.fromEntries(output.toJs()) as InspectPythonReturnType) : undefined,
      });
    }
  }
};

pythonWebWorker();

export {};
