import { GetCellsDB } from '../../../grid/sheet/Cells/GetCellsDB';
import { PythonReturnType } from '../pythonTypes';
import define_run_python from '../run_python.py';

export class PythonWebWorker {
  private pyodide: any;

  async load() {
    const { loadPyodide } = require('pyodide');
    this.pyodide = await loadPyodide();
    await this.pyodide.registerJsModule('GetCellsDB', GetCellsDB);
    await this.pyodide.loadPackage(['numpy', 'pandas', 'micropip']);

    // define a global py function called run_python used to run code from cells
    await this.pyodide.runPython(define_run_python);
  }

  // getCells(p0_x: number, p0_y: number, p1_x: number, p1_y: number): Cell[] {
  //   if (!this.webWorkers.app) {
  //     throw new Error('Expected app to be defined in mocks/PythonWebWorker');
  //   }
  //   const sheet = this.webWorkers.app.sheet_controller.sheet;
  //   return sheet.grid.getNakedCells(p0_x, p0_y, p1_x, p1_y, this.cellsToReplace);
  // }

  async run(python: string): Promise<PythonReturnType> {
    const output = await this.pyodide.globals.get('run_python')(python);
    return Object.fromEntries(output.toJs()) as PythonReturnType;
  }
}
