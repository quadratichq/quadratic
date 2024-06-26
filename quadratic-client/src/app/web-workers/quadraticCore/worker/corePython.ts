import { debugWebWorkers } from '@/app/debugFlags';
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
        if (this.lastTransactionId === e.data.transactionId) {
          this.lastTransactionId = undefined;
        }
        if (e.data.results.input_python_stack_trace) {
          e.data.results.std_err = e.data.results.input_python_stack_trace;
        }
        core.calculationComplete(e.data.transactionId, e.data.results);
        break;

      case 'pythonCoreGetCellsLength':
        const cells = core.getCells(
          e.data.transactionId,
          e.data.x,
          e.data.y,
          e.data.w,
          e.data.h,
          e.data.sheet,
          e.data.lineNumber
        );
        this.handleGetCellsResponse(e.data.sharedBuffer, cells);
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

  private handleGetCellsResponse(sharedBuffer: SharedArrayBuffer, cells: string) {
    const int32View = new Int32Array(sharedBuffer, 0, 3);
    Atomics.store(int32View, 1, cells.length);

    if (cells.length !== 0) {
      const id = this.id++;
      this.getCellsResponses[id] = cells;
      Atomics.store(int32View, 2, id);
    }

    Atomics.store(int32View, 0, 1);
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
