import { debugWebWorkers } from '@/app/debugFlags';
import { JsCodeResult, JsGetCellResponse } from '@/quadratic-core-types';
import { CorePythonMessage, PythonCoreMessage } from '../../pythonWebWorker/pythonCoreMessages';
import { core } from './core';

declare var self: WorkerGlobalScope &
  typeof globalThis & {
    sendRunPython: (transactionId: string, x: number, y: number, sheetId: string, code: string) => void;
  };

class CorePython {
  private corePythonPort?: MessagePort;

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
          if (!Array.isArray(results.array_output[0][0])) {
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
        };

        core.calculationComplete(codeResult);
        break;

      case 'pythonCoreGetCells':
        this.send({
          type: 'corePythonGetCells',
          id: e.data.id,
          cells: core.getCells(
            e.data.transactionId,
            e.data.x,
            e.data.y,
            e.data.w,
            e.data.h,
            e.data.sheet,
            e.data.lineNumber
          ),
        });
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

  sendGetCells(id: number, cells?: JsGetCellResponse[]) {
    this.send({
      type: 'corePythonGetCells',
      id,
      cells,
    });
  }

  cancelExecution() {
    // It's possible that the transaction was completed before the message was
    // received.
    if (this.lastTransactionId) {
      core.cancelExecution(this.lastTransactionId);
    }
  }
}

export const corePython = new CorePython();
