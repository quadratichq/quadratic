import { pythonWebWorker } from './pythonWebWorker/python';

export const initializeWebWorkers = (): void => {
  pythonWebWorker.init();
};

export const runPython = async (python_code: string): Promise<void> => {
  // return await pythonWebWorker.run(python_code);
};
