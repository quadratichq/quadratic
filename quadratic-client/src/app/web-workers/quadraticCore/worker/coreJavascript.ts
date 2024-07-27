import { debugWebWorkers } from '@/app/debugFlags';
import type { JsGetCellResponse } from '@/app/quadratic-core-types';
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

  init(JavascriptPort: MessagePort) {
    this.coreJavascriptPort = JavascriptPort;
    this.coreJavascriptPort.onmessage = this.handleMessage;
    self.sendRunJavascript = coreJavascript.sendRunJavascript;
    if (debugWebWorkers) console.log('[coreJavascript] initialized');
  }

  private handleMessage = (e: MessageEvent<JavascriptCoreMessage>) => {
    switch (e.data.type) {
      case 'javascriptCoreResults':
        if (this.lastTransactionId === e.data.transactionId) {
          this.lastTransactionId = undefined;
        }
        core.calculationComplete(e.data.results);
        break;

      case 'javascriptCoreGetCells':
        this.handleGetCellsResponse(
          e.data.id,
          e.data.transactionId,
          e.data.x,
          e.data.y,
          e.data.w,
          e.data.h,
          e.data.sheet,
          e.data.lineNumber
        );
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

  handleGetCellsResponse = (
    id: number,
    transactionId: string,
    x: number,
    y: number,
    w: number,
    h?: number,
    sheet?: string,
    lineNumber?: number
  ) => {
    const cellsString = core.getCells(transactionId, x, y, w, h, sheet, lineNumber);
    const cells = cellsString.length > 0 ? (JSON.parse(cellsString) as JsGetCellResponse[]) : undefined;
    this.send({
      type: 'coreJavascriptGetCells',
      id,
      cells,
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

  sendGetCells(id: number, cells?: JsGetCellResponse[]) {
    this.send({
      type: 'coreJavascriptGetCells',
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

export const coreJavascript = new CoreJavascript();
