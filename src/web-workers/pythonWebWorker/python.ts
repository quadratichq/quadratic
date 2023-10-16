import { grid, pointsToRect } from '../../grid/controller/Grid';
import { JsCodeResult } from '../../quadratic-core/quadratic_core';
import { PythonMessage, PythonReturnType } from './pythonTypes';

class PythonWebWorker {
  private worker?: Worker;
  private loaded = false;

  init() {
    this.worker = new Worker(new URL('./python.worker.ts', import.meta.url));

    this.worker.onmessage = async (e: MessageEvent<PythonMessage>) => {
      const event = e.data;
      if (event.type === 'results') {
        const pythonResult = event.results;
        if (!pythonResult) throw new Error('Expected results to be defined in python.ts');

        if (pythonResult.array_output) {
          if (!Array.isArray(pythonResult.array_output[0])) {
            pythonResult.array_output = pythonResult.array_output.flatMap((entry: string | number) => [
              [entry.toString()],
            ]);
          } else {
            pythonResult.array_output = pythonResult.array_output.map((entry: (string | number)[]) =>
              entry.map((entry: String | number) => entry.toString())
            );
          }
        }
        if (!pythonResult.success) {
          pythonResult.error_msg = pythonResult.input_python_stack_trace;
        }
        const result = new JsCodeResult(
          pythonResult.success,
          pythonResult.formatted_code,
          pythonResult.error_msg,
          pythonResult.std_out,
          pythonResult.output_value,
          JSON.stringify(pythonResult.array_output),
          pythonResult.line_number
        );
        grid.completeTransaction(result);

        // triggers any CodeEditor updates (if necessary)
        window.dispatchEvent(new CustomEvent('computation-complete'));
      } else if (event.type === 'get-cells') {
        const range = event.range;
        if (!range) {
          throw new Error('Expected range to be defined in get-cells');
        }
        const cells = grid.computeGetCells(
          pointsToRect(range.x0, range.y0, range.x1 - range.x0, range.y1 - range.y0),
          range.sheet,
          event.range?.lineNumber
        );
        // cells will be undefined if the sheet_id (currently name) is invalid
        if (cells && this.worker) {
          this.worker.postMessage({ type: 'get-cells', cells });
        }
      } else if (event.type === 'python-loaded') {
        window.dispatchEvent(new CustomEvent('python-loaded'));
        this.loaded = true;
      } else if (event.type === 'python-error') {
        window.dispatchEvent(new CustomEvent('python-error'));
      } else {
        throw new Error(`Unhandled pythonWebWorker.type ${event.type}`);
      }
    };
  }

  start(python: string) {
    if (!this.loaded || !this.worker) {
      return {
        complete: true,
        result: {
          success: false,
          error_msg: 'Error: Python not loaded',
          std_out: '',
          output_value: undefined,
          array_output: undefined,
          formatted_code: undefined,
        },
      };
    } else {
      this.worker.postMessage({ type: 'execute', python });
    }
  }

  getCells(cells: string) {
    if (!this.worker) throw new Error('Expected worker to be defined in python.ts');
    this.worker.postMessage({ type: 'get-cells', cells: JSON.parse(cells) });
  }

  changeOutput(_: Record<string, PythonReturnType>): void {}
}

export const pythonWebWorker = new PythonWebWorker();

declare global {
  interface Window {
    startPython: any;
    getCellsPython: any;
  }
}

// need to bind to window because rustWorker.ts cannot include any TS imports; see https://rustwasm.github.io/wasm-bindgen/reference/js-snippets.html#caveats
window.startPython = pythonWebWorker.start.bind(pythonWebWorker);
window.getCellsPython = pythonWebWorker.getCells.bind(pythonWebWorker);
