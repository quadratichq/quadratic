import { beforeAll, describe, expect, test, vi } from 'vitest';
import { LanguageState } from '../../languageTypes';
import { python } from './python';

let pythonState: LanguageState;
vi.mock('./pythonClient.ts', () => {
  return {
    pythonClient: {
      sendInit: () => (pythonState = 'ready'),
      getJwt: () => {},
      sendPythonState: (state: LanguageState) => (pythonState = state),
    },
  };
});

let pythonResults: any;
vi.mock('./pythonCore.ts', () => {
  return {
    pythonCore: {
      sendPythonResults: (_: string, results: any) => {
        pythonResults = results;
      },
    },
  };
});

beforeAll(async () => {
  return new Promise((resolve) => {
    const interval = setInterval(() => {
      if (pythonState === 'ready') {
        clearInterval(interval);
        resolve();
      }
    });
  });
});

async function runPython(code: string): Promise<any> {
  python.runPython({
    type: 'corePythonRun',
    transactionId: 'test',
    x: 0,
    y: 0,
    sheetId: 'test',
    code,
  });

  // wait for the results
  return await new Promise<any>((resolve) => {
    const interval = setInterval(() => {
      if (pythonResults) {
        clearInterval(interval);
        return resolve(pythonResults);
      }
    }, 100);
  });
}

beforeAll(async () => {});

describe('Python/Pyodide', () => {
  test(
    'can perform a simple calculation',
    async () => {
      let code = `
      5 + 3
`;
      let results = await runPython(code);
      console.log('results', results);

      expect(results).toEqual({
        output: ['8', 'number'],
        array_output: undefined,
        output_type: 'int',
        outputType: 'int',
        output_size: undefined,
        std_out: '',
        std_err: '',
        success: true,
        input_python_stack_trace: undefined,
        code: '\n      5 + 3\n',
        col_offset: 0,
        end_col_offset: 5,
        end_lineno: 2,
        lineno: 2,
        value_type: 'BinOp',
        formatted_code: '\n      5 + 3\n',
      });
    },
    30 * 1000
  );
});
