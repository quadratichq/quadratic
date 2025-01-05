import type { PythonRun } from '@/app/web-workers/pythonWebWorker/pythonTypes';

// mock the python output
export const mockPythonOutput = (responses: Record<string, string>): void => {
  const output: Record<string, PythonRun> = {};
  for (const key in responses) {
    output[key] = JSON.parse(responses[key]) as PythonRun;
  }

  // todo...
  // pythonWebWorker.changeOutput(output);
};
