import { debugWebWorkers } from '@/app/debugFlags';
import type { JsCellsA1Response } from '@/app/quadratic-core-types';
import { toUint8Array } from '@/app/shared/utils/Uint8Array';
import type {
  CorePythonMessage,
  PythonCoreGetCellsA1,
  PythonCoreMessage,
} from '@/app/web-workers/pythonWebWorker/pythonCoreMessages';
import { core } from '@/app/web-workers/quadraticCore/worker/core';

declare var self: WorkerGlobalScope &
  typeof globalThis & {
    sendRunPython: (transactionId: string, x: number, y: number, sheetId: string, code: string) => void;
  };

class CorePython {
  private corePythonPort?: MessagePort;

  // last running transaction (used to cancel execution)
  lastTransactionId?: string;

  init = (pythonPort: MessagePort) => {
    this.corePythonPort = pythonPort;
    this.corePythonPort.onmessage = this.handleMessage;
    self.sendRunPython = this.sendRunPython;
    if (debugWebWorkers) console.log('[corePython] initialized');
  };

  private handleMessage = (e: MessageEvent<PythonCoreMessage>) => {
    switch (e.data.type) {
      case 'pythonCoreResults':
        // todo: clean up the python completion message.
        if (this.lastTransactionId === e.data.transactionId) {
          this.lastTransactionId = undefined;
        }
        core.calculationComplete(e.data.jsCodeResultBuffer);
        break;

      case 'pythonCoreGetCellsA1':
        this.sendGetCellsA1(e.data);
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

  private sendGetCellsA1 = ({ sharedBuffer, transactionId, a1 }: PythonCoreGetCellsA1) => {
    const int32View = new Int32Array(sharedBuffer, 0, 1);

    let responseUint8Array: Uint8Array;
    try {
      responseUint8Array = core.getCellsA1(transactionId, a1);
    } catch (error: any) {
      const cellA1Response: JsCellsA1Response = {
        values: null,
        error: {
          core_error: `Failed to parse getCellsA1 response: ${error}`,
        },
      };
      responseUint8Array = toUint8Array(cellA1Response);
    }

    const byteLength = responseUint8Array.byteLength;
    sharedBuffer.grow(4 + byteLength);
    const uint8View = new Uint8Array(sharedBuffer, 4, responseUint8Array.byteLength);
    uint8View.set(responseUint8Array);

    Atomics.store(int32View, 0, 1);
    Atomics.notify(int32View, 0, 1);
  };

  private sendRunPython = (transactionId: string, x: number, y: number, sheetId: string, code: string) => {
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
      this.lastTransactionId = undefined;
    }
  }
}

export const corePython = new CorePython();
