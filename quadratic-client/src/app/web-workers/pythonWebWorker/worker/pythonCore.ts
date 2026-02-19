import { debugFlag } from '@/app/debugFlags/debugFlags';
import { getHasSharedArrayBuffer } from '@/app/helpers/sharedArrayBufferSupport';
import type { JsCellsA1Response } from '@/app/quadratic-core-types';
import type { CorePythonMessage, PythonCoreMessage } from '@/app/web-workers/pythonWebWorker/pythonCoreMessages';
import { python } from '@/app/web-workers/pythonWebWorker/worker/python';
import { handleCellsAsyncResponse, sendGetCellsA1Async } from './pythonCoreAsync';
import { sendGetCellsA1SAB } from './pythonCoreSAB';

export class PythonCore {
  private coreMessagePort?: MessagePort;

  init = (messagePort: MessagePort) => {
    this.coreMessagePort = messagePort;
    this.coreMessagePort.onmessage = this.handleMessage;

    if (debugFlag('debugWebWorkers')) console.log('[pythonCore] initialized');
  };

  private send = (message: PythonCoreMessage, transfer?: Transferable[]) => {
    if (!this.coreMessagePort) throw new Error('coreMessagePort not initialized');
    if (transfer) {
      this.coreMessagePort.postMessage(message, transfer);
    } else {
      this.coreMessagePort.postMessage(message);
    }
  };

  private handleMessage = async (e: MessageEvent<CorePythonMessage>) => {
    if (debugFlag('debugWebWorkersMessages')) console.log(`[pythonCore] message: ${e.data.type}`);

    switch (e.data.type) {
      case 'corePythonRun':
        python.runPython(e.data);
        return;
      case 'corePythonGetCellsA1Response':
        // Handle async response from core
        handleCellsAsyncResponse(e.data.requestId, e.data.response);
        return;
      default:
        console.warn('[pythonCore] Unhandled message type', e.data);
    }
  };

  sendPythonResults = (jsCodeResultBuffer: ArrayBuffer) => {
    this.send(
      {
        type: 'pythonCoreResults',
        jsCodeResultBuffer,
      },
      [jsCodeResultBuffer]
    );
  };

  /**
   * Get cells - routes to SAB or async implementation based on availability
   */
  sendGetCellsA1 = (transactionId: string, a1: string): JsCellsA1Response => {
    // SAB version - synchronous blocking
    return sendGetCellsA1SAB(this.send.bind(this), transactionId, a1);
  };

  /**
   * Get cells async - for use when SharedArrayBuffer is not available
   */
  sendGetCellsA1Async = (transactionId: string, a1: string): Promise<JsCellsA1Response> => {
    return sendGetCellsA1Async(this.send.bind(this), transactionId, a1);
  };

  /**
   * Whether SharedArrayBuffer is available
   */
  hasSharedArrayBuffer = (): boolean => {
    return getHasSharedArrayBuffer();
  };
}

export const pythonCore = new PythonCore();
