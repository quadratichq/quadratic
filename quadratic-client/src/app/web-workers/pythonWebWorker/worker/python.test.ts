import { toUint8Array } from '@/app/shared/utils/Uint8Array';
import type { LanguageState } from '@/app/web-workers/languageTypes';
import { python } from '@/app/web-workers/pythonWebWorker/worker/python';
import { beforeAll, describe, expect, test, vi } from 'vitest';

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
      sendPythonResults: (results: any) => {
        pythonResults = results;
      },
    },
  };
});

beforeAll(async () => {
  return new Promise<void>((resolve) => {
    const interval = setInterval(() => {
      if (pythonState === 'ready') {
        clearInterval(interval);
        resolve(undefined);
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
    chartPixelWidth: 600,
    chartPixelHeight: 460,
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
      const code = `
      5 + 3
`;
      const results = await runPython(code);
      const expected = {
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
        has_headers: false,
        col_offset: 0,
        end_col_offset: 5,
        end_lineno: 2,
        lineno: 2,
        value_type: 'BinOp',
        formatted_code: '\n      5 + 3\n',
      };

      const uint8Array = toUint8Array(expected);
      expect(results).toEqual(uint8Array.buffer);
    },
    30 * 1000
  );
});
