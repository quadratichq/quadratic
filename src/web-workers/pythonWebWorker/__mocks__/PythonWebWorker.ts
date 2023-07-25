import { PythonReturnType } from '../pythonTypes';

export class PythonWebWorker {
  private output?: Record<string, PythonReturnType>;

  changeOutput(output: Record<string, PythonReturnType>) {
    this.output = output;
  }

  async run(python_code: string): Promise<PythonReturnType> {
    if (!this.output) {
      throw new Error('Call webWorkers.pythonWebWorker.changeOutput to set mocked output');
    }
    return this.output[python_code];
  }
}
