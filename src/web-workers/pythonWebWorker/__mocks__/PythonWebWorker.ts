import { PythonReturnType } from '../pythonTypes';
import { setupPython } from '../../../setupPythonTests';

export class PythonWebWorker {
  pyodide: any;

  async load() {
    this.pyodide = await setupPython();
  }

  async run(python: string): Promise<PythonReturnType> {
    const output = await this.pyodide.globals.get('run_python')(python);
    return Object.fromEntries(output.toJs()) as PythonReturnType;
  }
}
