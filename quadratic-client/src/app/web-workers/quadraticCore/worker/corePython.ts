import { debugFlagWait } from '@/app/debugFlags/debugFlags';
import type { JsCellsA1Response } from '@/app/quadratic-core-types';
import { fromUint8Array, toUint8Array } from '@/app/shared/utils/Uint8Array';
import type {
  CorePythonMessage,
  PythonCoreGetCellsA1Async,
  PythonCoreGetCellsA1Data,
  PythonCoreGetCellsA1Length,
  PythonCoreMessage,
} from '@/app/web-workers/pythonWebWorker/pythonCoreMessages';
import { core } from '@/app/web-workers/quadraticCore/worker/core';
import { coreClient } from '@/app/web-workers/quadraticCore/worker/coreClient';

declare var self: WorkerGlobalScope &
  typeof globalThis & {
    sendRunPython: (
      transactionId: string,
      x: number,
      y: number,
      sheetId: string,
      code: string,
      chartPixelWidth: number,
      chartPixelHeight: number
    ) => void;
  };

interface PendingPythonRun {
  transactionId: string;
  x: number;
  y: number;
  sheetId: string;
  code: string;
  chartPixelWidth: number;
  chartPixelHeight: number;
}

class CorePython {
  private corePythonPort?: MessagePort;
  private id = 0;
  private getCellsResponses: Record<number, Uint8Array> = {};
  private pendingRun?: PendingPythonRun;

  // last running transaction (used to cancel execution)
  lastTransactionId?: string;

  constructor() {
    self.sendRunPython = this.sendRunPython;
  }

  init = async (pythonPort: MessagePort) => {
    this.corePythonPort = pythonPort;
    this.corePythonPort.onmessage = this.handleMessage;
    if (await debugFlagWait('debugWebWorkers')) console.log('[corePython] initialized');

    // Retry pending run if there is one
    if (this.pendingRun) {
      const pending = this.pendingRun;
      this.pendingRun = undefined;
      this.sendRunPython(
        pending.transactionId,
        pending.x,
        pending.y,
        pending.sheetId,
        pending.code,
        pending.chartPixelWidth,
        pending.chartPixelHeight
      );
    }
  };

  private handleMessage = (e: MessageEvent<PythonCoreMessage>) => {
    switch (e.data.type) {
      case 'pythonCoreResults':
        core.calculationComplete(e.data.jsCodeResultBuffer);
        break;

      case 'pythonCoreGetCellsA1Length':
        this.sendGetCellsA1Length(e.data);
        break;

      case 'pythonCoreGetCellsA1Data':
        this.sendGetCellsA1Data(e.data);
        break;

      case 'pythonCoreGetCellsA1Async':
        this.sendGetCellsA1Async(e.data);
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

  private ensurePortInitialized() {
    if (!this.corePythonPort) {
      coreClient.requestInitPython();
    }
  }

  private sendGetCellsA1Length = ({ sharedBuffer, transactionId, a1 }: PythonCoreGetCellsA1Length) => {
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
    const byteLength = responseUint8Array.byteLength;
    Atomics.store(int32View, 1, byteLength);

    if (byteLength !== 0) {
      const id = this.id++;
      this.getCellsResponses[id] = responseUint8Array;
      Atomics.store(int32View, 2, id);
    }

    Atomics.store(int32View, 0, 1);
    Atomics.notify(int32View, 0, 1);
  };

  private sendGetCellsA1Data = ({ id, sharedBuffer }: PythonCoreGetCellsA1Data) => {
    const int32View = new Int32Array(sharedBuffer, 0, 1);

    const responseUint8View = this.getCellsResponses[id];
    delete this.getCellsResponses[id];
    if (responseUint8View === undefined) {
      console.warn('[corePython] No cells found for id:', id);
    } else {
      const uint8View = new Uint8Array(sharedBuffer, 4, responseUint8View.byteLength);
      uint8View.set(responseUint8View);
    }

    Atomics.store(int32View, 0, 1);
    Atomics.notify(int32View, 0, 1);
  };

  /**
   * Handle async cell request (used when SharedArrayBuffer is not available)
   */
  private sendGetCellsA1Async = ({ requestId, transactionId, a1 }: PythonCoreGetCellsA1Async) => {
    let response: JsCellsA1Response;
    try {
      const responseUint8Array = core.getCellsA1(transactionId, a1);
      response = fromUint8Array<JsCellsA1Response>(responseUint8Array);
    } catch (e: any) {
      response = {
        values: null,
        error: {
          core_error: String(e),
        },
      };
    }

    this.send({
      type: 'corePythonGetCellsA1Response',
      requestId,
      response,
    });
  };

  private sendRunPython = (
    transactionId: string,
    x: number,
    y: number,
    sheetId: string,
    code: string,
    chartPixelWidth: number,
    chartPixelHeight: number
  ) => {
    if (!this.corePythonPort) {
      this.pendingRun = {
        transactionId,
        x,
        y,
        sheetId,
        code,
        chartPixelWidth,
        chartPixelHeight,
      };
      this.ensurePortInitialized();
      return;
    }
    this.lastTransactionId = transactionId;
    this.send({
      type: 'corePythonRun',
      transactionId,
      x,
      y,
      sheetId,
      code,
      chartPixelWidth,
      chartPixelHeight,
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
