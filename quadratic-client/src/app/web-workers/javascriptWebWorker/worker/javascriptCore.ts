import { debugWebWorkers, debugWebWorkersMessages } from '@/app/debugFlags';
import { JsCodeResult, JsGetCellResponse } from '@/app/quadratic-core-types';
import {
  CoreJavascriptGetCellsA1,
  CoreJavascriptMessage,
  JavascriptCoreMessage,
} from '@/app/web-workers/javascriptWebWorker/javascriptCoreMessages';
import { javascript } from '@/app/web-workers/javascriptWebWorker/worker/javascript/javascript';

class JavascriptCore {
  private coreMessagePort?: MessagePort;
  private id = 0;
  private waitingForResponse: Record<number, Function> = {};

  init(messagePort: MessagePort) {
    this.coreMessagePort = messagePort;
    this.coreMessagePort.onmessage = this.handleMessage;

    if (debugWebWorkers) console.log('[javascriptCore] initialized');
  }

  private send(message: JavascriptCoreMessage, transfer?: Transferable) {
    if (!this.coreMessagePort) throw new Error('coreMessagePort not initialized');
    if (transfer) {
      this.coreMessagePort.postMessage(message, [transfer]);
    } else {
      this.coreMessagePort.postMessage(message);
    }
  }

  private handleMessage = async (e: MessageEvent<CoreJavascriptMessage>) => {
    if (debugWebWorkersMessages) console.log(`[javascriptCore] message: ${e.data.type}`);

    switch (e.data.type) {
      case 'coreJavascriptRun':
        javascript.run(e.data);
        return;
    }

    if (e.data.id !== undefined) {
      const response = this.waitingForResponse[e.data.id];
      if (response) {
        response(e.data);
        delete this.waitingForResponse[e.data.id];
        return;
      } else {
        console.error(`[javascriptCore] no response for id ${e.data.id}`);
      }
    }

    console.warn("[javascriptCore] didn't handle message", e.data);
  };

  sendJavascriptResults(transactionId: string, results: JsCodeResult, transfer?: Transferable) {
    this.send(
      {
        type: 'javascriptCoreResults',
        transactionId,
        results,
      },
      transfer
    );
  }

  sendGetCellsA1(
    transactionId: string,
    a1: string,
    lineNumber?: number
  ): Promise<
    { cells: JsGetCellResponse[]; x: number; y: number; w: number; h: number; two_dimensional: boolean } | undefined
  > {
    return new Promise((resolve) => {
      const id = this.id++;
      this.waitingForResponse[id] = (message: CoreJavascriptGetCellsA1) => {
        if (
          message.cells !== undefined &&
          message.x !== undefined &&
          message.y !== undefined &&
          message.w !== undefined &&
          message.h !== undefined
        ) {
          resolve({
            cells: message.cells,
            x: message.x,
            y: message.y,
            w: message.w,
            h: message.h,
            two_dimensional: message.two_dimensional ?? false,
          });
        } else {
          resolve(undefined);
        }
      };
      this.send({ type: 'javascriptCoreGetCellsA1', transactionId, id, a1, lineNumber });
    });
  }
}

export const javascriptCore = new JavascriptCore();
