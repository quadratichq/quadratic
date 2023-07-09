// import { setupPython } from '../../../setupPythonTests';
import { PythonReturnType } from '../pythonTypes';
import { setupPython } from '../../../setupPythonTests';

export class PythonWebWorker {
  private pyodide?: any;

  async load() {
    this.pyodide = await setupPython();
  }

  async run(python: string): Promise<PythonReturnType> {
    if (!this.pyodide) {
      throw new Error('Expected pyodide to be defined');
    }
    const output = await this.pyodide.globals.get('run_python')(python);
    return Object.fromEntries(output.toJs()) as PythonReturnType;
  }
}
