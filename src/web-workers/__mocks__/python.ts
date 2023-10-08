import { PythonReturnType } from '../pythonWebWorker/pythonTypes';

class PythonWebWorker {
  private output?: Record<string, PythonReturnType>;

  changeOutput(output: Record<string, PythonReturnType>) {
    this.output = output;
  }

  async run(python_code: string): Promise<PythonReturnType> {
    if (!this.output) {
      throw new Error('Call webWorkers.pythonWebWorker.changeOutput to set mocked output');
    }
    if (!this.output[python_code]) {
      throw new Error(`mocked python output not defined: ${python_code.replaceAll('\n', '\\\\n')}`);
    }
    return this.output[python_code];
  }
}

export const pythonWebWorker = new PythonWebWorker();
