import { PixiApp } from '../gridGL/pixiApp/PixiApp';
import { PythonWebWorker } from './pythonWebWorker/PythonWebWorker';
import { PythonReturnType } from './pythonWebWorker/pythonTypes';

// todo: this will be moved to a top-level class within the app instead a singleton
export class WebWorkers {
  app?: PixiApp;
  pythonWebWorker?: PythonWebWorker;

  // this cannot be part of the constructor or mocking does not work
  // pixiapp
  init(app?: PixiApp) {
    this.app = app;
    this.pythonWebWorker = new PythonWebWorker(this, app);
  }

  async runPython(python_code: string): Promise<PythonReturnType> {
    if (!this.pythonWebWorker) {
      throw new Error('Expected pythonWebWorker to be defined');
    }
    return await this.pythonWebWorker.run(python_code);
  }
}

export const webWorkers = new WebWorkers();
