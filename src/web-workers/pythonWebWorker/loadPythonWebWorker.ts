/* eslint-disable no-restricted-globals */
/* eslint-disable no-undef */

import { Cell } from '../../schemas';
import { PythonMessage, PythonReturnType } from './pythonTypes';
import define_run_python from './run_python.py';

self.importScripts('https://cdn.jsdelivr.net/pyodide/v0.23.3/full/pyodide.js');

let getCellsMessages: (cells: Cell[]) => void | undefined;

// eslint-disable-next-line @typescript-eslint/no-unused-vars
const getCellsDB = async (x0: number, y0: number, x1: number, y1: number): Promise<Cell[]> => {
  return new Promise((resolve) => {
    getCellsMessages = (cells: Cell[]) => resolve(cells);
    self.postMessage({ type: 'get-cells', range: { x0, y0, x1, y1 } } as PythonMessage);
  });
};

let pyodide: any | undefined;

export async function loadPythonWebWorker() {
  pyodide = await (self as any).loadPyodide();
  await pyodide.registerJsModule('GetCellsDB', getCellsDB);
  await pyodide.loadPackage(['numpy', 'pandas', 'micropip']);
  const python_code = await (await fetch(define_run_python)).text();
  await pyodide.runPython(python_code);

  console.log('[Python WebWorker] Initiated');
  self.postMessage({ type: 'python-loaded' } as PythonMessage);
}

self.onmessage = async (e: MessageEvent<PythonMessage>) => {
  const event = e.data;
  if (event.type === 'get-cells') {
    if (event.cells && getCellsMessages) {
      getCellsMessages(event.cells);
    }
  } else if (event.type === 'execute') {
    // make sure loading is done
    if (!pyodide) {
      self.postMessage({ type: 'not-loaded' } as PythonMessage);
    }

    const output = await pyodide.globals.get('run_python')(event.python);

    return self.postMessage({
      type: 'results',
      results: Object.fromEntries(output.toJs()) as PythonReturnType,
    } as PythonMessage);
  }
};

loadPythonWebWorker();
