import { PixiApp } from '../gridGL/pixiApp/PixiApp';
import { PythonWebWorker } from './pythonWebWorker/PythonWebWorker';
import { PythonReturnType } from './pythonWebWorker/pythonTypes';

export class WebWorkers {
  app?: PixiApp;
  private pythonWebWorker: PythonWebWorker;

  constructor() {
    this.pythonWebWorker = new PythonWebWorker(this);
  }

  async runPython(python_code: string): Promise<PythonReturnType> {
    return this.pythonWebWorker.run(python_code);
  }
}

export const webWorkers = new WebWorkers();
