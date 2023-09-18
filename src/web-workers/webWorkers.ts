import { pythonWebWorker } from './pythonWebWorker/PythonWebWorker';
import { PythonReturnType } from './pythonWebWorker/pythonTypes';

export const initializeWebWorkers = (): void => {
  pythonWebWorker.init();
};

export const runPython = async (python_code: string): Promise<PythonReturnType> => {
  return await pythonWebWorker.run(python_code);
};
