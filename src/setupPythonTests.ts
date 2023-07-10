import { loadPyodide } from 'pyodide';
import { GetCellsDB } from './grid/sheet/Cells/GetCellsDB';
import define_run_python from './web-workers/pythonWebWorker/run_python.py';

export async function setupPython() {
  console.log('**** starting load of pyodide');
  const pyodide = (global as any).pyodide ?? (await loadPyodide());
  (global as any).pyodide = pyodide;
  console.log('**** registering getcells');
  pyodide.registerJsModule('GetCellsDB', GetCellsDB);
  console.log('*** loading packages....');
  await pyodide.loadPackage(['numpy', 'pandas', 'micropip']);

  // define a global py function called run_python used to run code from cells
  await pyodide.runPython(define_run_python);
  console.log('*** after runpython');
  return pyodide;
}
