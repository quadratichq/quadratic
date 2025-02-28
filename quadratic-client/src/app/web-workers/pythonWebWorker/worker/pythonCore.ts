import { debugWebWorkers, debugWebWorkersMessages } from '@/app/debugFlags';
import type { JsCellsA1Response } from '@/app/quadratic-core-types';
import type { CorePythonMessage, PythonCoreMessage } from '@/app/web-workers/pythonWebWorker/pythonCoreMessages';
import type { PythonRun } from '@/app/web-workers/pythonWebWorker/pythonTypes';
import { python } from '@/app/web-workers/pythonWebWorker/worker/python';

export class PythonCore {
  private coreMessagePort?: MessagePort;

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
  };

  sendPythonResults(transactionId: string, results: PythonRun) {
    this.send({
      type: 'pythonCoreResults',
      transactionId,
      results,
    });
  }

  sendGetCellsA1 = (transactionId: string, a1: string): JsCellsA1Response => {
    try {
      // This is a shared buffer that will be used to communicate with core
      // The first 4 bytes are used to signal the python core that the data is ready
      // The second 4 bytes are used to signal the length of the data
      // The third 4 bytes are used to signal the id of the data
      // Length of the cells string is unknown at this point
      let sharedBuffer: SharedArrayBuffer | undefined = new SharedArrayBuffer(4 + 4 + 4);
      let int32View: Int32Array | undefined = new Int32Array(sharedBuffer, 0, 3);
      Atomics.store(int32View, 0, 0);

      this.send({ type: 'pythonCoreGetCellsA1Length', sharedBuffer, transactionId, a1 });
      let result = Atomics.wait(int32View, 0, 0);
      const length = int32View[1];
      if (result !== 'ok' || length === 0)
        return { values: null, error: { core_error: 'Error in get cells a1 length' } };

      const id = int32View[2];

      // New shared buffer, which is sized to hold the cells string
      sharedBuffer = new SharedArrayBuffer(4 + length);
      int32View = new Int32Array(sharedBuffer, 0, 1);
      Atomics.store(int32View, 0, 0);

      this.send({ type: 'pythonCoreGetCellsA1Data', id, sharedBuffer });
      result = Atomics.wait(int32View, 0, 0);
      if (result !== 'ok') return { values: null, error: { core_error: 'Error in get cells a1 data' } };

      let uint8View: Uint8Array | undefined = new Uint8Array(sharedBuffer, 4, length);

      // Copy the data to a non-shared buffer, for decoding
      const nonSharedBuffer = new ArrayBuffer(uint8View.byteLength);
      const nonSharedView = new Uint8Array(nonSharedBuffer);
      nonSharedView.set(uint8View);
      sharedBuffer = undefined;
      int32View = undefined;
      uint8View = undefined;

      const decoder = new TextDecoder();
      const cellsStringified = decoder.decode(nonSharedView);
      const response = JSON.parse(cellsStringified) as JsCellsA1Response;
      return response;
    } catch (e) {
      console.warn('[pythonCore] getCellsA1 error', e);
    }
    return { values: null, error: { core_error: 'Error parsing getCellsA1 response' } };
  };
}

export const pythonCore = new PythonCore();
