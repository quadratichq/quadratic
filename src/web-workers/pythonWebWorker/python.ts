import { pointsToRect } from '../../grid/controller/Grid';
import { PythonMessage, PythonReturnType } from './pythonTypes';

class PythonWebWorker {
  private worker?: Worker;
  private callback?: (results: PythonReturnType) => void;
  private loaded = false;

  // rust function passed to get cells during computation cycle
  // @returns JSON {x: number, y: number: value: string}[] (eventually CellValue[] will be returned)
  private getCells?: (rect: any, sheetId: string | undefined) => string;

  init() {
    this.worker = new Worker(new URL('./python.worker.ts', import.meta.url));

    this.worker.onmessage = async (e: MessageEvent<PythonMessage>) => {
      const event = e.data;
      if (event.type === 'results') {
        if (this.callback && event.results) {
          console.log(event.results);
          debugger;
          this.callback(event.results);
          this.callback = undefined;
        }
      } else if (event.type === 'get-cells') {
        const range = event.range;
        if (!range) {
          throw new Error('Expected range to be defined in get-cells');
        }
        if (!this.getCells) {
          throw new Error('Expected getCells to be defined in PythonWebWorker');
        }
        const data = this.getCells(
          pointsToRect(range.x0, range.y0, range.x1 - range.x0, range.y1 - range.y0),
          range.sheet
        );
        const cells = JSON.parse(data) as any[];
        this.worker!.postMessage({ type: 'get-cells', cells } as PythonMessage);
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

  run(python: string, getCells: (sheetId: string | undefined, rect: any) => string): Promise<any> {
    return new Promise((resolve) => {
      if (!this.loaded || !this.worker) {
        resolve({
          cells_accessed: [],
          success: false,
          input_python_stack_trace: 'Error: Python not loaded',
          input_python_std_out: '',
          output_value: null,
          array_output: [],
          formatted_code: '',
        });
      } else {
        this.getCells = getCells;
        this.callback = (results: any) => resolve(results);
        this.worker.postMessage({ type: 'execute', python } as PythonMessage);
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
