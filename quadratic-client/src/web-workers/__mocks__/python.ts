import { PythonRun } from '../pythonWebWorker/pythonTypes';

class PythonWebWorker {
  private output?: Record<string, PythonRun>;

  changeOutput(output: Record<string, PythonRun>) {
    this.output = output;
  }

  async run(python_code: string): Promise<PythonRun> {
    if (!this.output) {
      throw new Error('Call webWorkers.pythonWebWorker.changeOutput to set mocked output');
    }
    if (!this.output[python_code]) {
      throw new Error(`mocked python output not defined: ${python_code}`);
    }
    return this.output[python_code];
  }
}

export const pythonWebWorker = new PythonWebWorker();
