import { PythonMessage, PythonReturnType } from './pythonTypes';
import { WebWorkers } from '../webWorkers';

export class PythonWebWorker {
  private webWorkers: WebWorkers;
  private worker: Worker;
  private callback?: (results: PythonReturnType) => void;

  constructor(webWorkers: WebWorkers) {
    this.webWorkers = webWorkers;

    this.worker = new Worker(new URL('./loadPythonWebWorker.ts', import.meta.url));

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
      } else {
        throw new Error(`Unhandled pythonWebWorker.type ${event.type}`);
      }
    };
  }

  run(python: string): Promise<PythonReturnType> {
    return new Promise((resolve) => {
      this.callback = (results: PythonReturnType) => resolve(results);
      this.worker.postMessage({ type: 'execute', python } as PythonMessage);
    });
  }
}
