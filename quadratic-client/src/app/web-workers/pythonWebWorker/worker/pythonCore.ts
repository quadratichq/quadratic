import { debugWebWorkers, debugWebWorkersMessages } from '@/app/debugFlags';
import { JsGetCellResponse } from '@/app/quadratic-core-types';
import type { CorePythonGetCells, CorePythonMessage, PythonCoreMessage } from '../pythonCoreMessages';
import type { PythonRun } from '../pythonTypes';
import { python } from './python';

class PythonCore {
  private coreMessagePort?: MessagePort;
  private id = 0;
  private waitingForResponse: Record<number, Function> = {};

  init(messagePort: MessagePort) {
    this.coreMessagePort = messagePort;
    this.coreMessagePort.onmessage = this.handleMessage;

    if (debugWebWorkers) console.log('[pythonCore] initialized');
  }

  private send(message: PythonCoreMessage) {
    if (!this.coreMessagePort) throw new Error('coreMessagePort not initialized');
    this.coreMessagePort.postMessage(message);
  }

  private handleMessage = async (e: MessageEvent<CorePythonMessage>) => {
    if (debugWebWorkersMessages) console.log(`[pythonCore] message: ${e.data.type}`);

    switch (e.data.type) {
      case 'corePythonRun':
        python.runPython(e.data);
        return;
    }

    if (e.data.id !== undefined) {
      const response = this.waitingForResponse[e.data.id];
      if (response) {
        response(e.data);
        delete this.waitingForResponse[e.data.id];
        return;
      } else {
        console.error(`[pythonCore] no response for id ${e.data.id}`);
      }
    }

    console.warn("[pythonCore] didn't handle message", e.data);
  };

  sendPythonResults(transactionId: string, results: PythonRun) {
    this.send({
      type: 'pythonCoreResults',
      transactionId,
      results,
    });
  }

  sendGetCells(
    transactionId: string,
    x: number,
    y: number,
    w: number,
    h: number,
    sheet?: string,
    lineNumber?: number
  ): Promise<JsGetCellResponse[] | undefined> {
    return new Promise((resolve) => {
      const id = this.id++;
      this.waitingForResponse[id] = (message: CorePythonGetCells) => resolve(message.cells);
      this.send({ type: 'pythonCoreGetCells', transactionId, id, x, y, w, h, sheet, lineNumber });
    });
  }
}

export const pythonCore = new PythonCore();
