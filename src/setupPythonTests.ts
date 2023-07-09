import { GetCellsDB } from './grid/sheet/Cells/GetCellsDB';
import { loadPyodide } from 'pyodide/pyodide';
import define_run_python from './web-workers/pythonWebWorker/run_python.py';

const getCellsDB = (x0: number, y0: number, x1: number, y1: number) => GetCellsDB(x0, y0, x1, y1);

export async function setupPython() {
  const pyodide = await loadPyodide();
  await pyodide.registerJsModule('GetCellsDB', getCellsDB);
  await pyodide.loadPackage(['numpy', 'pandas', 'micropip']);

  // define a global py function called run_python used to run code from cells
  await pyodide.runPython(define_run_python);
  return pyodide;
}
