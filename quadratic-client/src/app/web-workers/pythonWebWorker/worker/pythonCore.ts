import { debugWebWorkers, debugWebWorkersMessages } from '@/app/debugFlags';
import type { JsCellsA1Response } from '@/app/quadratic-core-types';
import { fromUint8Array } from '@/app/shared/utils/Uint8Array';
import type { CorePythonMessage, PythonCoreMessage } from '@/app/web-workers/pythonWebWorker/pythonCoreMessages';
import { python } from '@/app/web-workers/pythonWebWorker/worker/python';

export class PythonCore {
  private coreMessagePort?: MessagePort;

  init(messagePort: MessagePort) {
    this.coreMessagePort = messagePort;
    this.coreMessagePort.onmessage = this.handleMessage;

    if (debugWebWorkers) console.log('[pythonCore] initialized');
  }

  private send(message: PythonCoreMessage, transfer?: Transferable[]) {
    if (!this.coreMessagePort) throw new Error('coreMessagePort not initialized');
    if (transfer) {
      this.coreMessagePort.postMessage(message, transfer);
    } else {
      this.coreMessagePort.postMessage(message);
    }
  }

  private handleMessage = async (e: MessageEvent<CorePythonMessage>) => {
    if (debugWebWorkersMessages) console.log(`[pythonCore] message: ${e.data.type}`);

    switch (e.data.type) {
      case 'corePythonRun':
        python.runPython(e.data);
        return;
      default:
        console.warn('[pythonCore] Unhandled message type', e.data);
    }
  };

  sendPythonResults(jsCodeResultBuffer: ArrayBuffer) {
    this.send(
      {
        type: 'pythonCoreResults',
        jsCodeResultBuffer,
      },
      [jsCodeResultBuffer]
    );
  }

  sendGetCellsA1 = (transactionId: string, a1: string): JsCellsA1Response => {
    try {
      // This is a growable shared buffer that will be used to communicate with core
      // The first 4 bytes are used to signal the python core that the data is ready
      let sharedBuffer: SharedArrayBuffer | undefined = new SharedArrayBuffer(4, {
        maxByteLength: 4 * 1024 * 1024 * 1024, // 4GB
      });
      let int32View: Int32Array | undefined = new Int32Array(sharedBuffer, 0, 1);
      Atomics.store(int32View, 0, 0);

      this.send({ type: 'pythonCoreGetCellsA1', sharedBuffer, transactionId, a1 });
      Atomics.wait(int32View, 0, 0);
      int32View = undefined;

      const byteLength = sharedBuffer.byteLength;
      if (byteLength <= 4) {
        return { values: null, error: { core_error: 'Error in get cells a1 length' } };
      }

      // Copy the data to a non-shared buffer, for decoding
      let uint8View: Uint8Array | undefined = new Uint8Array(sharedBuffer, 4, byteLength - 4);
      const nonSharedBuffer = new ArrayBuffer(uint8View.byteLength);
      const nonSharedView = new Uint8Array(nonSharedBuffer);
      nonSharedView.set(uint8View);
      uint8View = undefined;
      sharedBuffer = undefined;

      const response = fromUint8Array<JsCellsA1Response>(nonSharedView);
      return response;
    } catch (e) {
      console.warn('[pythonCore] getCellsA1 error', e);
    }
    return { values: null, error: { core_error: 'Error parsing getCellsA1 response' } };
  };
}

export const pythonCore = new PythonCore();
