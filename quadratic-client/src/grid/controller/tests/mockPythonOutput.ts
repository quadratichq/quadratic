import { PythonReturnType } from '../../../web-workers/pythonWebWorker/pythonTypes';
import { pythonWebWorker } from '../../../web-workers/pythonWebWorker/pythonWebWorker';

// mock the python output
export const mockPythonOutput = (responses: Record<string, string>): void => {
  const output: Record<string, PythonReturnType> = {};
  for (const key in responses) {
    output[key] = JSON.parse(responses[key]) as PythonReturnType;
  }
  pythonWebWorker.changeOutput(output);
};
