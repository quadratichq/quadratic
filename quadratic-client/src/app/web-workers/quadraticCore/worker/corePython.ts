import { debugWebWorkers } from '@/app/debugFlags';
import type { JsCellsA1Response } from '@/app/quadratic-core-types';
import { toUint8Array } from '@/app/shared/utils/toUint8Array';
import type { CorePythonMessage, PythonCoreMessage } from '@/app/web-workers/pythonWebWorker/pythonCoreMessages';
import { core } from '@/app/web-workers/quadraticCore/worker/core';

declare var self: WorkerGlobalScope &
  typeof globalThis & {
    sendRunPython: (transactionId: string, x: number, y: number, sheetId: string, code: string) => void;
  };

class CorePython {
  private corePythonPort?: MessagePort;
  private id = 0;
  private getCellsResponses: Record<number, Uint8Array> = {};

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

      case 'pythonCoreGetCellsA1Length':
        this.sendGetCellsA1Length(e.data.sharedBuffer, e.data.transactionId, e.data.a1);
        break;

      case 'pythonCoreGetCellsA1Data':
        this.sendGetCellsA1Data(e.data.id, e.data.sharedBuffer);
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

  private sendGetCellsA1Length = (sharedBuffer: SharedArrayBuffer, transactionId: string, a1: string) => {
    const int32View = new Int32Array(sharedBuffer, 0, 3);

    let responseUint8Array: Uint8Array;
    try {
      responseUint8Array = core.getCellsA1(transactionId, a1);
    } catch (e: any) {
      const cellA1Response: JsCellsA1Response = {
        values: null,
        error: {
          core_error: e,
        },
      };
      responseUint8Array = toUint8Array(cellA1Response);
    }

    const length = responseUint8Array.length;

    Atomics.store(int32View, 1, length);
    if (length !== 0) {
      const id = this.id++;
      this.getCellsResponses[id] = responseUint8Array;
      Atomics.store(int32View, 2, id);
    }
    Atomics.store(int32View, 0, 1);
    Atomics.notify(int32View, 0, 1);
  };

  private sendGetCellsA1Data = (id: number, sharedBuffer: SharedArrayBuffer) => {
    const responseUint8View = this.getCellsResponses[id];
    delete this.getCellsResponses[id];
    const int32View = new Int32Array(sharedBuffer, 0, 1);
    if (responseUint8View === undefined) {
      console.warn('[corePython] No cells found for id:', id);
    } else {
      const uint8View = new Uint8Array(sharedBuffer, 4, responseUint8View.length);
      uint8View.set(responseUint8View);
    }
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
    }
  }
}

export const corePython = new CorePython();
