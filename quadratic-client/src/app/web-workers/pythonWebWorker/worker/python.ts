import { debugWebWorkers } from '@/app/debugFlags';
import { JsGetCellResponse } from '@/app/quadratic-core-types';
import type { CodeRun } from '@/app/web-workers/CodeRun';
import { LanguageState } from '@/app/web-workers/languageTypes';
import { PyodideInterface, loadPyodide } from 'pyodide';
import type { CorePythonRun } from '../pythonCoreMessages';
import type { InspectPython, PythonError, PythonSuccess, outputType } from '../pythonTypes';
import { pythonClient } from './pythonClient';
import { pythonCore } from './pythonCore';

const TRY_AGAIN_TIMEOUT = 500;
const IS_TEST = typeof process !== 'undefined' && process.env.NODE_ENV === 'test';

// eslint-disable-next-line no-restricted-globals
const SELF = self;

function isEmpty(value: [string, outputType] | string | null | undefined) {
  return value == null || (typeof value === 'string' && value.trim().length === 0);
}

class Python {
  private pyodide: PyodideInterface | undefined;
  private awaitingExecution: CodeRun[];
  state: LanguageState;
  private transactionId?: string;

  constructor() {
    this.awaitingExecution = [];
    this.state = 'loading';
    this.init();
  }

  private getCells = (
    x0: number,
    y0: number,
    x1: number,
    y1: number,
    sheet?: string,
    lineNumber?: number
  ): JsGetCellResponse[] | undefined => {
    if (!this.transactionId) {
      throw new Error('No transactionId in getCells');
    }
    const cells = pythonCore.getCells(this.transactionId, x0, y0, x1 - x0 + 1, y1 - y0 + 1, sheet, lineNumber);
    if (!cells) {
      // we reload pyodide if there is an error getting cells
      this.init();
      pythonClient.sendPythonState('ready');
    } else {
      return cells;
    }
  };

  init = async () => {
    const jwt = await pythonClient.getJwt();

    // patch XMLHttpRequest to send requests to the proxy
    SELF['XMLHttpRequest'] = new Proxy(XMLHttpRequest, {
      construct: function (target, args) {
        const xhr = new target();

        xhr.open = new Proxy(xhr.open, {
          apply: function (
            target,
            thisArg,
            args: [
              method: string,
              url: string | URL,
              async: boolean,
              username?: string | null | undefined,
              password?: string | null | undefined
            ]
          ) {
            Object.defineProperty(xhr, '__url', { value: args[1].toString(), writable: true });
            args[1] = `${pythonClient.env.VITE_QUADRATIC_CONNECTION_URL}/proxy`;
            return target.apply(thisArg, args);
          },
        });

        xhr.onreadystatechange = function () {
          if (xhr.readyState === XMLHttpRequest.OPENED) {
            xhr.setRequestHeader('Proxy', (xhr as any).__url);
            xhr.setRequestHeader('Authorization', `Bearer ${jwt}`);
          }
          // After complition of XHR request
          if (xhr.readyState === 4) {
            if (xhr.status === 401) {
            }
          }
        };

        return xhr;
      },
    });

    this.pyodide = await loadPyodide({
      stdout: () => {},
      indexURL: IS_TEST ? 'public/pyodide' : '/pyodide',
      packages: [
        'micropip',
        'pyodide-http',
        'pandas',
        'requests',
        `${IS_TEST ? 'public' : ''}/quadratic_py-0.1.0-py3-none-any.whl`,
      ],
    });

    this.pyodide.registerJsModule('getCellsDB', this.getCells);

    // patch requests https://github.com/koenvo/pyodide-http
    await this.pyodide.runPythonAsync('import pyodide_http; pyodide_http.patch_all();');

    // disable urllib3 warnings
    await this.pyodide.runPythonAsync(`import requests; requests.packages.urllib3.disable_warnings();`);

    try {
      // make run_python easier to call later
      await this.pyodide.runPython('from quadratic_py.run_python import run_python');
      await this.pyodide.runPythonAsync('from quadratic_py.inspect_python import inspect_python');
    } catch (e: any) {
      pythonClient.sendPythonLoadError(e?.message);
      console.warn(`[Python WebWorker] failed to load`, e);
      this.state = 'error';
      setTimeout(this.init, TRY_AGAIN_TIMEOUT);
      return;
    }

    const pythonVersion = this.pyodide.runPython('import platform; platform.python_version()');
    const pyodideVersion = this.pyodide.version;

    if (debugWebWorkers) console.log(`[Python] loaded Python v.${pythonVersion} via Pyodide v.${pyodideVersion}`);

    pythonClient.sendInit(pythonVersion);
    pythonClient.sendPythonState('ready');
    this.state = 'ready';
    this.next();
  };

  private corePythonRunToCodeRun = (corePythonRun: CorePythonRun): CodeRun => {
    return {
      transactionId: corePythonRun.transactionId,
      sheetPos: { x: corePythonRun.x, y: corePythonRun.y, sheetId: corePythonRun.sheetId },
      code: corePythonRun.code,
    };
  };

  private codeRunToCorePython = (codeRun: CodeRun): CorePythonRun => ({
    type: 'corePythonRun',
    transactionId: codeRun.transactionId,
    x: codeRun.sheetPos.x,
    y: codeRun.sheetPos.y,
    sheetId: codeRun.sheetPos.sheetId,
    code: codeRun.code,
  });

  private next = async () => {
    if (this.state === 'ready' && this.awaitingExecution.length > 0) {
      const run = this.awaitingExecution.shift();
      if (run) {
        await this.runPython(this.codeRunToCorePython(run));
        this.state = 'ready';
      }
    }
  };

  private async inspectPython(pythonCode: string): Promise<InspectPython | undefined> {
    if (!this.pyodide) {
      console.warn('Python not loaded');
    } else {
      const output = await this.pyodide.globals.get('inspect_python')(pythonCode);

      if (output === undefined) {
        return undefined;
      }

      return Object.fromEntries(output.toJs()) as InspectPython;
    }
  }

  async runPython(message: CorePythonRun) {
    if (!this.pyodide || this.state !== 'ready') {
      this.awaitingExecution.push(this.corePythonRunToCodeRun(message));
      return;
    }

    pythonClient.sendPythonState('running', {
      current: this.corePythonRunToCodeRun(message),
      awaitingExecution: this.awaitingExecution,
    });

    this.transactionId = message.transactionId;

    // auto load packages
    await this.pyodide.loadPackagesFromImports(message.code, {
      messageCallback: () => 0,
      errorCallback: (e) => console.warn(e),
    });

    let result: any; // result of Python execution
    let pythonRun: any;
    let output: PythonSuccess | PythonError | undefined;
    let inspectionResults: InspectPython | undefined;

    try {
      result = await this.pyodide.globals.get('run_python')(message.code, { x: message.x, y: message.y });
      output = Object.fromEntries(result.toJs()) as PythonSuccess | PythonError;
      inspectionResults = await this.inspectPython(message.code || '');
      let outputType = output?.output_type || '';

      const empty2dArray =
        Array.isArray(output.output_size) && output.output_size[0] === 0 && output.output_size[1] === 0;
      const nothingReturned = (output.output_type === 'NoneType' && isEmpty(output.output)) || empty2dArray;

      if (!output) throw new Error('Expected results to be defined in python.ts');

      if (nothingReturned) {
        output.array_output = undefined;
        output.typed_array_output = undefined;
        output.output = ['', 'blank'];
      } else {
        if (output.array_output && output.array_output.length) {
          if (!Array.isArray(output.array_output[0][0])) {
            output.array_output = output.array_output.map((row: any) => [row]);
          }
        }
      }

      if (output.output_size) {
        outputType = `${output.output_size[0]}x${output.output_size[1]} ${outputType}`;
      }

      pythonRun = {
        ...output,
        ...inspectionResults,
        outputType,
      };
    } catch (e) {
      // gracefully recover from deserialization errors
      console.warn(e);

      pythonRun = output ? output : ({} as PythonError);

      pythonRun = {
        ...pythonRun,
        array_output: [],
        typed_array_output: [],
        success: false,
        std_err: String(e),
        input_python_stack_trace: String(e),
      };
    }
    if (pythonRun) pythonCore.sendPythonResults(message.transactionId, pythonRun);

    // destroy the output as it can cause memory leaks
    if (result) result.destroy();

    pythonClient.sendPythonState('ready', { current: undefined });
    this.state = 'ready';
    setTimeout(this.next, 0);
  }
}

export const python = new Python();
