import { PythonReturnType } from '../pythonTypes';
import { setupPython } from '../../../setupPythonTests';

export class PythonWebWorker {
  private pyodide?: any;

  async run(python: string): Promise<PythonReturnType> {
    // if (!this.pyodide) {
    const pyodide = await setupPython();
    // }
    return await pyodide.globals.get('run_python')(python);
  }
}
