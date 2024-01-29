import { SheetPos } from '@/gridGL/types/size';
import { multiplayer } from '@/multiplayer/multiplayer';
import mixpanel from 'mixpanel-browser';
import { grid, pointsToRect } from '../../grid/controller/Grid';
import { JsCodeResult } from '../../quadratic-core/quadratic_core';
import { PythonMessage, PythonReturnType } from './pythonTypes';

const stringOrNumber = (input: string | number | undefined): string => {
  if (typeof input === 'undefined') {
    return '';
  }

  if (typeof input === 'string') {
    return input;
  }

  return input.toString();
};

interface PythonCode {
  transactionId: string;
  sheetPos: SheetPos;
  code: string;
}

class PythonWebWorker {
  private worker?: Worker;
  private loaded = false;
  private running = false;
  private executionStack: PythonCode[] = [];

  private calculationComplete() {
    this.running = false;
    this.executionStack.shift();
    this.next(true);
  }

  init() {
    this.worker = new Worker(new URL('./python.worker.ts', import.meta.url));

    this.worker.onmessage = async (e: MessageEvent<PythonMessage>) => {
      const event = e.data;
      if (event.type === 'results') {
        if (this.executionStack.length === 0) {
          throw new Error('Expected executionStack to have at least one element in python.ts');
        }
        const transactionId = this.executionStack[0].transactionId;
        const pythonResult = event.results;
        if (!pythonResult) throw new Error('Expected results to be defined in python.ts');

        if (pythonResult.array_output) {
          if (!Array.isArray(pythonResult.array_output[0])) {
            pythonResult.array_output = pythonResult.array_output.flatMap((entry: string | number | undefined) => [
              [stringOrNumber(entry)],
            ]);
          } else {
            pythonResult.array_output = pythonResult.array_output.map((entry: (string | number)[]) =>
              entry.map((entry: string | number | undefined) => stringOrNumber(entry))
            );

            // ensure that the 2d array has equally sized rows
            const size = pythonResult.array_output[0].length;
            for (let i = 1; i < pythonResult.array_output.length; i++) {
              while (pythonResult.array_output[i].length < size) {
                pythonResult.array_output[i].push('');
              }
            }
          }
        }
        if (!pythonResult.success) {
          pythonResult.error_msg = pythonResult.input_python_stack_trace;
        }
        const result = new JsCodeResult(
          transactionId,
          pythonResult.success,
          pythonResult.formatted_code,
          pythonResult.error_msg,
          pythonResult.std_out,
          pythonResult.output_value,
          JSON.stringify(pythonResult.array_output),
          pythonResult.line_number,
          pythonResult.cancel_compute
        );
        grid.calculationComplete(result);
        this.calculationComplete();
      } else if (event.type === 'get-cells') {
        if (this.executionStack.length === 0) {
          throw new Error('Expected executionStack to have at least one element in python.ts');
        }
        const transactionId = this.executionStack[0].transactionId;
        const range = event.range;
        if (!range) {
          throw new Error('Expected range to be defined in get-cells');
        }
        const cells = grid.calculationGetCells(
          transactionId,
          pointsToRect(range.x0, range.y0, range.x1 - range.x0, range.y1 - range.y0),
          range.sheet !== undefined ? range.sheet.toString() : undefined,
          event.range?.lineNumber
        );
        // cells will be undefined if there was a problem getting the cells. In this case, the python execution is done.
        if (cells) {
          this.worker!.postMessage({ type: 'get-cells', cells });
        } else {
          this.calculationComplete();
        }
      } else if (event.type === 'python-loaded') {
        window.dispatchEvent(new CustomEvent('python-loaded'));
        this.loaded = true;
        this.next(false);
      } else if (event.type === 'python-error') {
        window.dispatchEvent(new CustomEvent('python-error'));
      } else if (event.type === 'not-loaded') {
        window.dispatchEvent(new CustomEvent('python-loading'));
      } else {
        throw new Error(`Unhandled pythonWebWorker.type ${event.type}`);
      }
    };
  }

  getRunningCells(sheetId: string): SheetPos[] {
    return this.executionStack.filter((cell) => cell.sheetPos.sheetId === sheetId).map((cell) => cell.sheetPos);
  }

  runPython(transactionId: string, x: number, y: number, sheetId: string, code: string) {
    this.executionStack.push({ transactionId, sheetPos: { x, y, sheetId }, code });
    this.next(false);
  }

  getCodeRunning(): SheetPos[] {
    return this.executionStack.map((cell) => cell.sheetPos);
  }

  private showChange() {
    window.dispatchEvent(new CustomEvent('python-change'));
    multiplayer.sendCodeRunning(this.getCodeRunning());
  }

  next(complete: boolean) {
    if (complete) {
      this.running = false;
    }
    if (!this.worker || !this.loaded || this.running) {
      this.showChange();
      return;
    }
    if (this.executionStack.length) {
      const first = this.executionStack[0];
      if (first) {
        if (!this.running) {
          this.running = true;
          window.dispatchEvent(new CustomEvent('python-computation-started'));
        }
        this.worker.postMessage({ type: 'execute', python: first.code });
      }
    } else if (complete) {
      window.dispatchEvent(new CustomEvent('python-computation-finished'));
    }
    this.showChange();
  }

  stop() {
    if (this.worker) {
      this.worker.terminate();
    }
  }

  restart() {
    this.stop();
    this.init();
  }

  restartFromUser() {
    mixpanel.track('[PythonWebWorker].restartFromUser');
    if (this.executionStack.length === 0) {
      throw new Error('Expected executionStack to have at least one element in restartFromUser');
    }
    const transactionId = this.executionStack[0].transactionId;
    this.restart();
    const result = new JsCodeResult(
      transactionId,
      false,
      undefined,
      'Python execution cancelled by user',
      undefined,
      undefined,
      undefined,
      undefined,
      true
    );
    grid.calculationComplete(result);
  }

  getCells(cells: string) {
    if (!this.worker) throw new Error('Expected worker to be defined in python.ts');
    this.worker.postMessage({ type: 'get-cells', cells: JSON.parse(cells) });
  }

  changeOutput(_: Record<string, PythonReturnType>): void {}
}

export const pythonWebWorker = new PythonWebWorker();

// need to bind to window because rustCallbacks.ts cannot include any TS imports; see https://rustwasm.github.io/wasm-bindgen/reference/js-snippets.html#caveats
window.runPython = pythonWebWorker.runPython.bind(pythonWebWorker);
