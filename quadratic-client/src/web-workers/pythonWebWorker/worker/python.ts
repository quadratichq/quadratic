import { debugWebWorkers } from '@/debugFlags';
import { PyodideInterface, loadPyodide } from 'pyodide';
import { pythonClient } from './pythonClient';
import { pythonCore } from './pythonCore';

const TRY_AGAIN_TIMEOUT = 500;

// declare var self: WorkerGlobalScope &
//   typeof globalThis & {
//   };

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
}

export const python = new Python();
