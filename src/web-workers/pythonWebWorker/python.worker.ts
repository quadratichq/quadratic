/* eslint-disable no-restricted-globals */

import { PythonMessage, PythonReturnType } from './pythonTypes';
import define_run_python from './run_python.py';

const TRY_AGAIN_TIMEOUT = 500;

self.importScripts('/pyodide/pyodide.js');

let getCellsMessages: (cells: { x: number; y: number; value: string }[]) => void | undefined;

const getCellsDB = async (
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  sheet?: string
): Promise<{ x: number; y: number; value: string }[]> => {
  return new Promise((resolve) => {
    getCellsMessages = (cells: { x: number; y: number; value: string }[]) => resolve(cells);
    self.postMessage({ type: 'get-cells', range: { x0, y0, x1, y1, sheet } } as PythonMessage);
  });
};

let pyodide: any | undefined;

async function pythonWebWorker() {
  try {
    pyodide = await (self as any).loadPyodide();
    await pyodide.registerJsModule('getCellsDB', getCellsDB);
    await pyodide.loadPackage(['numpy', 'pandas', 'micropip']);
    const python_code = await (await fetch(define_run_python)).text();
    await pyodide.runPython(python_code);
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
  if (event.type === 'get-cells') {
    console.log('worker: getCells', event.cells);
    if (event.cells && getCellsMessages) {
      getCellsMessages(event.cells);
    }
  } else if (event.type === 'execute') {
    console.log('worker: execute');
    // make sure loading is done
    if (!pyodide) {
      self.postMessage({ type: 'not-loaded' } as PythonMessage);
    }

    const output = await pyodide.globals.get('run_python')(event.python);
    console.log(output, Object.fromEntries(output.toJs()));
    return self.postMessage({
      type: 'results',
      results: Object.fromEntries(output.toJs()) as PythonReturnType,
    } as PythonMessage);
  }
};

pythonWebWorker();

export {};
