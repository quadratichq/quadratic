/* eslint-disable @typescript-eslint/no-unused-vars */
import { debugWebWorkers } from '@/debugFlags';
import { PyodideInterface, loadPyodide } from 'pyodide';
import { CorePythonRun } from '../pythonCoreMessages';
import { InspectPython, PythonError, PythonSuccess } from '../pythonTypes';
import { pythonClient } from './pythonClient';
import { pythonCore } from './pythonCore';

const TRY_AGAIN_TIMEOUT = 500;

class Python {
  private pyodide: PyodideInterface | undefined;

  constructor() {
    this.init();
  }

  private getCells = async (
    x0: number,
    y0: number,
    x1: number,
    y1: number,
    sheet?: string,
    lineNumber?: number
  ): Promise<{ x: number; y: number; value: string; type_name: string }[]> => {
    return await pythonCore.sendGetCells(x0, y0, x1, y1, sheet, lineNumber);
  };

  init = async () => {
    this.pyodide = await loadPyodide({
      stdout: () => {},
      indexURL: '/pyodide',
      packages: ['micropip', 'pyodide-http', 'pandas', '/quadratic_py-0.1.0-py3-none-any.whl'],
    });
    this.pyodide.registerJsModule('getCellsDB', this.getCells);

    // patch requests https://github.com/koenvo/pyodide-http
    await this.pyodide.runPythonAsync('import pyodide_http; pyodide_http.patch_all();');

    try {
      // make run_python easier to call later
      await this.pyodide.runPython('from quadratic_py.run_python import run_python');
      await this.pyodide.runPythonAsync('from quadratic_py.inspect_python import inspect_python');
    } catch (e: any) {
      pythonClient.sendPythonLoadError(e?.message);
      console.warn(`[Python WebWorker] failed to load`, e);
      setTimeout(this.init, TRY_AGAIN_TIMEOUT);
      return;
    }

    const pythonVersion = this.pyodide.runPython('import platform; platform.python_version()');
    const pyodideVersion = this.pyodide.version;

    if (debugWebWorkers) console.log(`[Python] loaded Python v.${pythonVersion} via Pyodide v.${pyodideVersion}`);
    pythonClient.sendPythonLoaded(pythonVersion);
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
    if (!this.pyodide) {
      console.warn('Python not loaded');
      return;
    }

    // make sure loading is done
    if (!this.pyodide) {
      console.warn('do something with the python message...probably a queue or something');
    } else {
      // auto load packages
      await this.pyodide.loadPackagesFromImports(message.code);

      let result: any; // result of Python execution
      let pythonRun: any;
      let output: PythonSuccess | PythonError | undefined;
      let inspectionResults: InspectPython | undefined;
      try {
        result = await this.pyodide.globals.get('run_python')(message.code, [message.x, message.y]);
        output = Object.fromEntries(result.toJs()) as PythonSuccess | PythonError;
        inspectionResults = await this.inspectPython(message.code || '');

        pythonRun = {
          ...output,
          ...inspectionResults,
        };
      } catch (e) {
        // gracefully recover from deserialization errors
        console.warn(e);
        if (output) {
          pythonRun = output;
        } else {
          pythonRun = {} as PythonError;
        }
        pythonRun = {
          ...pythonRun,
          array_output: [],
          typed_array_output: [],
          success: false,
          std_err: String(e),
          input_python_stack_trace: String(e),
        };
      }
      if (pythonRun) {
        pythonCore.sendPythonResults(message.transactionId, pythonRun);
      }

      // destroy the output as it can cause memory leaks
      if (result) result.destroy();
    }
  }
}

export const python = new Python();
