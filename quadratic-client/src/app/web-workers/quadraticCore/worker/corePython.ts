import { debugWebWorkers } from '@/app/debugFlags';
import { JsCodeResult } from '@/app/quadratic-core-types';
import { CorePythonMessage, PythonCoreMessage } from '../../pythonWebWorker/pythonCoreMessages';
import { core } from './core';

declare var self: WorkerGlobalScope &
  typeof globalThis & {
    sendRunPython: (transactionId: string, x: number, y: number, sheetId: string, code: string) => void;
  };

class CorePython {
  private corePythonPort?: MessagePort;
  private id = 0;
  private getCellsResponses: Record<number, string> = {};

  // last running transaction (used to cancel execution)
  lastTransactionId?: string;

  init(pythonPort: MessagePort) {
    this.corePythonPort = pythonPort;
    this.corePythonPort.onmessage = this.handleMessage;
    self.sendRunPython = corePython.sendRunPython;
    if (debugWebWorkers) console.log('[corePython] initialized');
  }

  private handleMessage = (e: MessageEvent<PythonCoreMessage>) => {
    switch (e.data.type) {
      case 'pythonCoreResults':
        // todo: clean up the python completion message.
        if (this.lastTransactionId === e.data.transactionId) {
          this.lastTransactionId = undefined;
        }
        if (e.data.results.input_python_stack_trace) {
          e.data.results.std_err = e.data.results.input_python_stack_trace;
        }
        const results = e.data.results;
        let output_array: string[][][] | null = null;
        if (results.array_output) {
          // A 1d list was provided. We convert it to a 2d array by changing each entry into an array.
          if (!Array.isArray(results.array_output?.[0]?.[0])) {
            output_array = (results.array_output as any).map((row: any) => [row]);
          } else {
            output_array = results.array_output as any as string[][][];
          }
        }

        const codeResult: JsCodeResult = {
          transaction_id: e.data.transactionId,
          success: results.success,
          std_err: results.std_err,
          std_out: results.std_out,
          output_value: results.output ? (results.output as any as string[]) : null,
          output_array,
          line_number: results.lineno ?? null,
          output_display_type: results.output_type ?? null,
          cancel_compute: false,
          chart_pixel_output: null, //results.chart_pixel_output ?? null,
        };

        core.calculationComplete(codeResult);
        break;

      case 'pythonCoreGetCellsLength':
        this.sendGetCellsLength(
          e.data.sharedBuffer,
          e.data.transactionId,
          e.data.x,
          e.data.y,
          e.data.w,
          e.data.h,
          e.data.sheet,
          e.data.lineNumber
        );
        break;

      case 'pythonCoreGetCellsData':
        this.sendGetCellsData(e.data.id, e.data.sharedBuffer);
        break;

      default:
        console.warn('[corePython] Unhandled message type', e.data);
    }
  };

  private send(message: CorePythonMessage) {
    if (!this.corePythonPort) {
      console.warn('Expected corePythonPort to be defined in CorePython.send');
      return;
    }
    this.corePythonPort.postMessage(message);
  }

  private sendGetCellsLength(
    sharedBuffer: SharedArrayBuffer,
    transactionId: string,
    x: number,
    y: number,
    w: number,
    h: number,
    sheet?: string,
    lineNumber?: number
  ) {
    const int32View = new Int32Array(sharedBuffer, 0, 3);
    try {
      const cells = core.getCells(transactionId, x, y, w, h, sheet, lineNumber);

      // need to get the bytes of the string (which covers unicode characters)
      const length = new Blob([cells]).size;

      Atomics.store(int32View, 1, length);
      if (length !== 0) {
        const id = this.id++;
        this.getCellsResponses[id] = cells;
        Atomics.store(int32View, 2, id);
      }
      Atomics.store(int32View, 0, 1);
    } catch (e) {
      console.warn('[corePython] Error getting cells:', e);
    }
    Atomics.notify(int32View, 0, 1);
  }

  private sendGetCellsData(id: number, sharedBuffer: SharedArrayBuffer) {
    const cells = this.getCellsResponses[id];
    delete this.getCellsResponses[id];
    const int32View = new Int32Array(sharedBuffer, 0, 1);
    if (cells === undefined) {
      console.warn('[corePython] No cells found for id:', id);
    } else {
      const encoder = new TextEncoder();
      const encodedCells = encoder.encode(cells);
      const uint8View = new Uint8Array(sharedBuffer, 4, encodedCells.length);
      uint8View.set(encodedCells);
    }
    Atomics.store(int32View, 0, 1);
    Atomics.notify(int32View, 0, 1);
  }

  sendRunPython = (transactionId: string, x: number, y: number, sheetId: string, code: string) => {
    this.lastTransactionId = transactionId;
    this.send({
      type: 'corePythonRun',
      transactionId,
      x,
      y,
      sheetId,
      code,
    });
  };

  cancelExecution() {
    // It's possible that the transaction was completed before the message was
    // received.
    if (this.lastTransactionId) {
      core.cancelExecution(this.lastTransactionId);
    }
  }
}

export const corePython = new CorePython();
