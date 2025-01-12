import { debugWebWorkers } from '@/app/debugFlags';
import type { CellA1Response } from '@/app/quadratic-core-types';
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
        core.calculationComplete(e.data.results);
        break;

      case 'javascriptCoreGetCellsA1':
        this.handleGetCellsA1Response(e.data.id, e.data.transactionId, e.data.a1, e.data.lineNumber);
        break;

      default:
        console.warn('[coreJavascript] Unhandled message type', e.data);
    }
  };

  private send(message: CoreJavascriptMessage) {
    if (!this.coreJavascriptPort) {
      console.warn('Expected coreJavascriptPort to be defined in CoreJavascript.send');
      return;
    }
    this.coreJavascriptPort.postMessage(message);
  }

  private handleGetCellsA1Response = (id: number, transactionId: string, a1: string, lineNumber?: number) => {
    let cells: CellA1Response | undefined;
    try {
      const cellsString = core.getCellsA1(transactionId, a1, lineNumber);
      if (cellsString) {
        cells = JSON.parse(cellsString) as CellA1Response;
      }
    } catch (_e) {
      // core threw and handled the error
    }
    this.send({
      type: 'coreJavascriptGetCellsA1',
      id,
      cells: cells?.cells,
      x: cells ? Number(cells.x) : undefined,
      y: cells ? Number(cells.y) : undefined,
      w: cells ? Number(cells.w) : undefined,
      h: cells ? Number(cells.h) : undefined,
      two_dimensional: cells ? cells.two_dimensional : false,
    });
  };

  sendRunJavascript = (transactionId: string, x: number, y: number, sheetId: string, code: string) => {
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
    }
  }
}

export const coreJavascript = new CoreJavascript();
