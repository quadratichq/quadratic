import { debugWebWorkers, debugWebWorkersMessages } from '@/app/debugFlags';
import type { JsGetCellResponse } from '@/app/quadratic-core-types';
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

  getCells(
    transactionId: string,
    x: number,
    y: number,
    w: number,
    h: number,
    sheet?: string,
    lineNumber?: number
  ): JsGetCellResponse[] | undefined {
    try {
      // This is a shared buffer that will be used to communicate with core
      // The first 4 bytes are used to signal the python core that the data is ready
      // The second 4 bytes are used to signal the length of the data
      // The third 4 bytes are used to signal the id of the data
      // Length of the cells string is unknown at this point
      let sharedBuffer: SharedArrayBuffer | undefined = new SharedArrayBuffer(4 + 4 + 4);
      let int32View: Int32Array | undefined = new Int32Array(sharedBuffer, 0, 3);
      Atomics.store(int32View, 0, 0);

      this.send({ type: 'pythonCoreGetCellsLength', sharedBuffer, transactionId, x, y, w, h, sheet, lineNumber });
      let result = Atomics.wait(int32View, 0, 0);
      const length = int32View[1];
      if (result !== 'ok' || length === 0) return undefined;

      const id = int32View[2];

      // New shared buffer, which is sized to hold the cells string
      sharedBuffer = new SharedArrayBuffer(4 + length);
      int32View = new Int32Array(sharedBuffer, 0, 1);
      Atomics.store(int32View, 0, 0);

      this.send({ type: 'pythonCoreGetCellsData', id, sharedBuffer });
      result = Atomics.wait(int32View, 0, 0);
      if (result !== 'ok') return undefined;

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
      const cells = JSON.parse(cellsStringified) as JsGetCellResponse[];
      return cells;
    } catch (e) {
      console.warn('[pythonCore] getCells error', e);
    }
    return undefined;
  }
}

export const pythonCore = new PythonCore();
