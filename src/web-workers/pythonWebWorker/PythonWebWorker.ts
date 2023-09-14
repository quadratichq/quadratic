import { GetCellsDB } from '../../grid/sheet/Cells/GetCellsDB';
import { PythonMessage, PythonReturnType } from './pythonTypes';

export class PythonWebWorker {
  private worker: Worker;
  private callback?: (results: PythonReturnType) => void;
  private loaded = false;

  constructor() {
    this.worker = new Worker(new URL('./python.worker.ts', import.meta.url));

    this.worker.onmessage = async (e: MessageEvent<PythonMessage>) => {
      const event = e.data;
      if (event.type === 'results') {
        if (this.callback && event.results) {
          this.callback(event.results);
          this.callback = undefined;
        }
      } else if (event.type === 'get-cells') {
        const range = event.range;
        if (!range) {
          throw new Error('Expected range to be defined in get-cells');
        }
        const cells = await GetCellsDB(range.x0, range.y0, range.x1, range.y1);
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

  changeOutput(_: Record<string, PythonReturnType>): void {}
}
