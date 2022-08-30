import { GetCellsDB } from '../../gridDB/Cells/GetCellsDB';

//@ts-expect-error
import define_run_python from './run_python.py';

declare global {
  // <- [reference](https://stackoverflow.com/a/56458070/11542903)
  interface Window {
    pyodide: any;
    loadPyodide: any;
  }
}

export async function loadPython() {
  window.pyodide = await window.loadPyodide({
    // indexURL: '/pyodide/',
    // redirect Pyodide output to console
    stdout: (l: string) => {
      console.log('[WASMPython]', l);
    },
    stderr: (e: string) => {
      console.log('[WASMPython stdoerr]', e);
    },
  });

  await window.pyodide.registerJsModule('GetCellsDB', GetCellsDB);
  await window.pyodide.loadPackage(['numpy', 'pandas', 'micropip']);

  // define a global py function called run_python used to run code from cells
  const python_code = await (await fetch(define_run_python)).text();
  await window.pyodide.runPython(python_code);
}
