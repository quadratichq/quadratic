import '@vitest/web-worker';
import 'fake-indexeddb/auto';
import { beforeAll, describe, expect, test } from 'vitest';
import { pythonWebWorker } from '../pythonWebWorker/pythonWebWorker';

// export {};

async function loadPythonWorker() {
  let loaded = false;
  // await init();
  pythonWebWorker.init();

  window.addEventListener('python-loaded', () => {
    console.log('python-loaded');
    loaded = true;
  });

  // wait for python to load
  await new Promise<void>((resolve) => {
    const interval = setInterval(() => {
      if (loaded) {
        clearInterval(interval);
        return resolve();
      }
    }, 500);
  });
}

async function waitForResults(code: string): Promise<any> {
  let gotResults = false;
  let results: any = undefined;

  const listener = (e: Event) => {
    results = (e as CustomEvent).detail;
    gotResults = true;
    window.removeEventListener('python-results', listener);
  };

  window.addEventListener('python-results', listener);

  // todo...
  // pythonWebWorker.runPython('0', 0, 0, '0', code);

  // wait for the results
  return await new Promise<any>((resolve) => {
    const interval = setInterval(() => {
      if (gotResults) {
        clearInterval(interval);
        return resolve(results);
      }
    }, 100);
  });
}

beforeAll(async () => {});

describe('Python/Pyodide', () => {
  test(
    'can perform a simple calculation',
    async () => {
      await loadPythonWorker();

      let code = `
      5 + 3
`;
      let results = await waitForResults(code);
      console.log('results', results);

      expect(results).toEqual({
        output: ['8', 'number'],
        array_output: undefined,
        output_type: 'int',
        output_size: undefined,
        cells_accessed: [],
        std_out: '',
        std_err: '',
        success: true,
        input_python_stack_trace: undefined,
        code: '\n      5 + 3\n',
        formatted_code: '\n5 + 3\n',
        col_offset: 0,
        end_col_offset: 5,
        end_lineno: 2,
        lineno: 2,
        value_type: 'BinOp',
      });
    },
    30 * 1000
  );
});
