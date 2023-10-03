import { pointsToRect } from '../../grid/controller/Grid';
import { JsComputeResult } from '../../quadratic-core/quadratic_core';
import { PythonMessage, PythonReturnType } from './pythonTypes';

class PythonWebWorker {
  private worker?: Worker;
  private callback?: (results: JsComputeResult) => void;
  private loaded = false;

  init() {
    this.worker = new Worker(new URL('./python.worker.ts', import.meta.url));

    this.worker.onmessage = async (e: MessageEvent<PythonMessage>) => {
      const event = e.data;
      if (event.type === 'results') {
        const result = event.results;
        if (!this.callback) throw new Error('Expected callback to be defined in python.ts');
        if (!result) throw new Error('Expected results to be defined in python.ts');
        if (result.array_output) {
          if (!Array.isArray(result.array_output[0])) {
            result.array_output = result.array_output.flatMap((entry: string | number) => [[entry.toString()]]);
          } else {
            result.array_output = result.array_output.map((entry: (string | number)[]) =>
              entry.map((entry: String | number) => entry.toString())
            );
          }
        }
        if (!result.success) {
          result.error_msg = result.input_python_stack_trace;
        }
        this.callback({
          complete: true,
          result,
        });
        this.callback = undefined;
      } else if (event.type === 'get-cells') {
        const range = event.range;
        if (!range) {
          throw new Error('Expected range to be defined in get-cells');
        }
        if (!this.callback) {
          throw new Error('Expected callback to be defined in python');
        }
        this.callback({
          complete: false,
          rect: pointsToRect(range.x0, range.y0, range.x1 - range.x0, range.y1 - range.y0),
          sheet_id: event.range?.sheet,
        });
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

  run(python: string, cells?: string): Promise<JsComputeResult> {
    return new Promise((resolve) => {
      if (!this.loaded || !this.worker) {
        resolve({
          complete: true,
          result: {
            success: false,
            error_msg: 'Error: Python not loaded',
            std_out: '',
            output_value: undefined,
            array_output: undefined,
            formatted_code: undefined,
          },
        });
      } else {
        this.callback = resolve;
        if (cells) {
          this.worker.postMessage({ type: 'get-cells', cells: JSON.parse(cells) });
        } else {
          this.worker.postMessage({ type: 'execute', python });
        }
      }
    });
  }

  changeOutput(_: Record<string, PythonReturnType>): void {}
}

export const pythonWebWorker = new PythonWebWorker();

declare global {
  interface Window {
    runPython: any;
  }
}

// need to bind to window because rustWorker.ts cannot include any TS imports; see https://rustwasm.github.io/wasm-bindgen/reference/js-snippets.html#caveats
window.runPython = pythonWebWorker.run.bind(pythonWebWorker);
