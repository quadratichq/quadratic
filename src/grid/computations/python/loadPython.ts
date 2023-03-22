import { GetCellsDB } from '../../sheet/Cells/GetCellsDB';

import define_run_python from './run_python.py';
import define_inspect_python from './inspect_python.py';

declare global {
  // <- [reference](https://stackoverflow.com/a/56458070/11542903)
  interface Window {
    pyodide: any;
    loadPyodide: any;
  }
}

export async function setupPython(pyodide: any) {
  await pyodide.registerJsModule('GetCellsDB', GetCellsDB);
  await pyodide.loadPackage(['numpy', 'pandas', 'micropip']);

  // install autopep8
  await pyodide.runPythonAsync('import micropip');
  await pyodide.runPythonAsync('await micropip.install("autopep8")');

  // define a global py function called run_python used to run code from cells
  if (typeof window === 'undefined') {
    // Node environment (jest tests)
    await pyodide.runPythonAsync(define_run_python);
    await pyodide.runPythonAsync(define_inspect_python);
  } else {
    // Browser environment
    await window.pyodide.runPython(await (await fetch(define_run_python)).text());
    await window.pyodide.runPython(await (await fetch(define_inspect_python)).text());
  }
}

export async function loadPython() {
  window.pyodide = await window.loadPyodide({
    // redirect Pyodide output to console
    stdout: (l: string) => {
      console.log('[WASM/Python]', l);
    },
    stderr: (e: string) => {
      console.log('[WASM/Python stdoerr]', e);
    },
  });

  await setupPython(window.pyodide);
}
