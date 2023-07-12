import { PythonMessage, PythonReturnType } from './pythonTypes';
import { WebWorkers } from '../webWorkers';

export class PythonWebWorker {
  private webWorkers: WebWorkers;
  private worker: Worker;
  private callback?: (results: PythonReturnType) => void;
  private loaded = false;

  constructor(webWorkers: WebWorkers) {
    this.webWorkers = webWorkers;

    this.worker = new Worker(new URL('./python.worker.ts', import.meta.url));

    this.worker.onmessage = (e: MessageEvent<PythonMessage>) => {
      const event = e.data;
      if (event.type === 'results') {
        if (this.callback && event.results) {
          this.callback(event.results);
          this.callback = undefined;
        }
      } else if (event.type === 'get-cells') {
        if (!this.webWorkers.app) {
          throw new Error('Expected app to be defined in WebWorkers');
        }
        const range = event.range;
        if (!range) {
          throw new Error('Expected range to be defined in get-cells');
        }
        const cells = this.webWorkers.app.sheet.grid.getNakedCells(range.x0, range.y0, range.x1, range.y1);
        this.worker.postMessage({ type: 'get-cells', cells } as PythonMessage);
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

  run(python: string): Promise<PythonReturnType> {
    return new Promise((resolve) => {
      if (!this.loaded) {
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
        this.callback = (results: PythonReturnType) => resolve(results);
        this.worker.postMessage({ type: 'execute', python } as PythonMessage);
      }
    });
  }

  async load() {
    // this is used by the mock
  }
}
