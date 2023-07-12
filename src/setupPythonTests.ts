import { GetCellsDB } from './grid/sheet/Cells/GetCellsDB';
import define_run_python from './web-workers/pythonWebWorker/run_python.py';

export async function setupPython() {
  const { loadPyodide } = require('pyodide');
  const pyodide = await loadPyodide();
  pyodide.registerJsModule('GetCellsDB', GetCellsDB);
  await pyodide.loadPackage(['numpy', 'pandas', 'micropip']);

  // // define a global py function called run_python used to run code from cells
  await pyodide.runPython(define_run_python);
  return pyodide;
}
