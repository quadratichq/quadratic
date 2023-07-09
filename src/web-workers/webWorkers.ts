import { PixiApp } from '../gridGL/pixiApp/PixiApp';
import { PythonWebWorker } from './pythonWebWorker/PythonWebWorker';
import { PythonReturnType } from './pythonWebWorker/pythonTypes';

export class WebWorkers {
  app?: PixiApp;
  pythonWebWorker?: PythonWebWorker;

  init(app?: PixiApp) {
    this.app = app;
    this.pythonWebWorker = new PythonWebWorker(this);
  }

  async runPython(python_code: string): Promise<PythonReturnType> {
    if (!this.pythonWebWorker) {
      throw new Error('expected pythonWebWorker to be defined');
    }
    return await this.pythonWebWorker.run(python_code);
  }
}

export const webWorkers = new WebWorkers();
