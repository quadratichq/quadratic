import { debugWebWorkers, debugWebWorkersMessages } from '@/debugFlags';
import { CorePythonMessage, PythonCoreMessage } from '../pythonCoreMessages';
import { PythonRun } from '../pythonTypes';
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
    if (debugWebWorkersMessages) console.log(`[coreClient] message: ${e.data.type}`);

    switch (e.data.type) {
      case 'corePythonRun':
        python.runPython(e.data);
        break;

      default:
        console.warn('[coreClient] Unhandled message type', e.data);
    }

    // if (e.data.id) {
    //   const response = this.waitingForResponse[e.data.id];
    //   if (response) {
    //     response(e.data);
    //     delete this.waitingForResponse[e.data.id];
    //   }
    // }
  };

  sendPythonResults(transactionId: string, results: PythonRun) {
    this.send({
      type: 'pythonCoreResults',
      transactionId,
      results,
    });
  }

  sendGetCells(
    x0: number,
    y0: number,
    x1: number,
    y1: number,
    sheet?: string,
    lineNumber?: number
  ): Promise<{ x: number; y: number; value: string; type_name: string }[]> {
    return new Promise((resolve) => {
      const id = this.id++;
      this.waitingForResponse[id] = (cells: { x: number; y: number; value: string; type_name: string }[]) =>
        resolve(cells);
      resolve([]);
    });
  }
}

export const pythonCore = new PythonCore();
