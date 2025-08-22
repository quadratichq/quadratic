import { debugFlag } from '@/app/debugFlags/debugFlags';
import type {
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

    if (debugFlag('debugWebWorkers')) console.log('[javascriptCore] initialized');
  }

  private send(message: JavascriptCoreMessage, transfer?: Transferable[]) {
    if (!this.coreMessagePort) throw new Error('coreMessagePort not initialized');
    if (transfer) {
      this.coreMessagePort.postMessage(message, transfer);
    } else {
      this.coreMessagePort.postMessage(message);
    }
  }

  private handleMessage = async (e: MessageEvent<CoreJavascriptMessage>) => {
    if (debugFlag('debugWebWorkersMessages')) console.log(`[javascriptCore] message: ${e.data.type}`);

    switch (e.data.type) {
      case 'coreJavascriptRun':
        await javascript.run(e.data);
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

  sendJavascriptResults(transactionId: string, jsCodeResultBuffer: ArrayBuffer) {
    this.send(
      {
        type: 'javascriptCoreResults',
        transactionId,
        jsCodeResultBuffer,
      },
      [jsCodeResultBuffer]
    );
  }

  sendGetCellsA1 = (transactionId: string, a1: string): Promise<ArrayBuffer> => {
    return new Promise((resolve) => {
      const id = this.id++;
      this.waitingForResponse[id] = (message: CoreJavascriptGetCellsA1) => {
        resolve(message.cellsA1ResponseBuffer);
      };
      this.send({ type: 'javascriptCoreGetCellsA1', transactionId, id, a1 });
    });
  };
}

export const javascriptCore = new JavascriptCore();
