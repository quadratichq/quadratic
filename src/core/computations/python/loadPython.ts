import { GetCellsDB } from '../../gridDB/Cells/GetCellsDB';

import define_run_python from './run_python.py';

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

  // define a global py function called run_python used to run code from cells
  if (typeof window === 'undefined') {
    // Node environment (jest tests)
    await pyodide.runPython(define_run_python);
  } else {
    // Browser environment
    const python_code = await (await fetch(define_run_python)).text();
    await window.pyodide.runPython(python_code);
  }
}

export async function loadPython() {
  window.pyodide = await window.loadPyodide({
    // redirect Pyodide output to console
    stdout: (l: string) => {
      console.log('[WASMPython]', l);
    },
    stderr: (e: string) => {
      console.log('[WASMPython stdoerr]', e);
    },
  });

  setupPython(window.pyodide);
}
