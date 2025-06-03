import { debugWebWorkers } from '@/app/debugFlags';
import type { JsCellsA1Response } from '@/app/quadratic-core-types';
import { toUint8Array } from '@/app/shared/utils/Uint8Array';
import type {
  CoreJavascriptMessage,
  JavascriptCoreMessage,
} from '@/app/web-workers/javascriptWebWorker/javascriptCoreMessages';
import { core } from '@/app/web-workers/quadraticCore/worker/core';

declare var self: WorkerGlobalScope &
  typeof globalThis & {
    sendRunJavascript: (transactionId: string, x: number, y: number, sheetId: string, code: string) => void;
  };

class CoreJavascript {
  private coreJavascriptPort?: MessagePort;

  // last running transaction (used to cancel execution)
  lastTransactionId?: string;

  init = (JavascriptPort: MessagePort) => {
    this.coreJavascriptPort = JavascriptPort;
    this.coreJavascriptPort.onmessage = this.handleMessage;
    self.sendRunJavascript = this.sendRunJavascript;
    if (debugWebWorkers) console.log('[coreJavascript] initialized');
  };

  private handleMessage = (e: MessageEvent<JavascriptCoreMessage>) => {
    switch (e.data.type) {
      case 'javascriptCoreResults':
        if (this.lastTransactionId === e.data.transactionId) {
          this.lastTransactionId = undefined;
        }
        core.calculationComplete(e.data.jsCodeResultBuffer);
        break;

      case 'javascriptCoreGetCellsA1':
        this.handleGetCellsA1Response(e.data.id, e.data.transactionId, e.data.a1);
        break;

      default:
        console.warn('[coreJavascript] Unhandled message type', e.data);
    }
  };

  private send(message: CoreJavascriptMessage, transfer?: Transferable[]) {
    if (!this.coreJavascriptPort) {
      console.warn('Expected coreJavascriptPort to be defined in CoreJavascript.send');
      return;
    }
    if (transfer) {
      this.coreJavascriptPort.postMessage(message, transfer);
    } else {
      this.coreJavascriptPort.postMessage(message);
    }
  }

  private handleGetCellsA1Response = (id: number, transactionId: string, a1: string) => {
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

    // Convert string to ArrayBuffer for transfer
    const cellsA1ResponseBuffer = responseUint8Array.buffer as ArrayBuffer;

    this.send(
      {
        type: 'coreJavascriptGetCellsA1',
        id,
        cellsA1ResponseBuffer,
      },
      [cellsA1ResponseBuffer]
    );
  };

  private sendRunJavascript = (transactionId: string, x: number, y: number, sheetId: string, code: string) => {
    this.lastTransactionId = transactionId;
    this.send({
      type: 'coreJavascriptRun',
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

export const coreJavascript = new CoreJavascript();
