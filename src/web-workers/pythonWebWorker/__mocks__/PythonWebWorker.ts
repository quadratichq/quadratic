import { PythonReturnType } from '../pythonTypes';
import { setupPython } from '../../../setupPythonTests';

export class PythonWebWorker {
  pyodide: any;

  async load() {
    this.pyodide = await setupPython();
  }

  async run(python: string): Promise<PythonReturnType> {
    console.log('*** before run_python');
    const output = await this.pyodide.globals.get('run_python')(python);
    console.log('*** after run_python');
    return Object.fromEntries(output.toJs()) as PythonReturnType;
  }
}
