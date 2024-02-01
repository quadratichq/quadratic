//@ts-ignore

import { pythonWebWorker } from './pythonWebWorker/python';

export const initializeWebWorkers = (): void => {
  pythonWebWorker.init();
};
