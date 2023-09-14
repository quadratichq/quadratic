import { PythonReturnType } from '../../../web-workers/pythonWebWorker/pythonTypes';
import { webWorkers } from '../../../web-workers/webWorkers';

// mock the python output
export const mockPythonOutput = (responses: Record<string, string>): void => {
  const output: Record<string, PythonReturnType> = {};
  for (const key in responses) {
    output[key] = JSON.parse(responses[key]) as PythonReturnType;
  }
  webWorkers.pythonWebWorker?.changeOutput(output);
};
