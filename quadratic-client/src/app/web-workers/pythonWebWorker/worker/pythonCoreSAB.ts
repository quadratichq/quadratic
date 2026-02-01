/**
 * SharedArrayBuffer implementation for Python cell access.
 *
 * This uses SharedArrayBuffer and Atomics.wait() to synchronously block
 * until cell data is available from the core worker.
 */

import type { JsCellsA1Response } from '@/app/quadratic-core-types';
import { fromUint8Array } from '@/app/shared/utils/Uint8Array';
import type { PythonCoreMessage } from '@/app/web-workers/pythonWebWorker/pythonCoreMessages';

/**
 * Get cells using SharedArrayBuffer and Atomics.wait (synchronous/blocking)
 */
export function sendGetCellsA1SAB(
  send: (message: PythonCoreMessage, transfer?: Transferable[]) => void,
  transactionId: string,
  a1: string
): JsCellsA1Response {
  try {
    // This is a shared buffer that will be used to communicate with core
    // The first 4 bytes are used to signal the python core that the data is ready
    // The second 4 bytes are used to signal the length of the data
    // The third 4 bytes are used to signal the id of the data
    // Length of the cells string is unknown at this point
    let sharedBuffer: SharedArrayBuffer | undefined = new SharedArrayBuffer(4 + 4 + 4);
    let int32View: Int32Array | undefined = new Int32Array(sharedBuffer, 0, 3);
    Atomics.store(int32View, 0, 0);

    send({ type: 'pythonCoreGetCellsA1Length', sharedBuffer, transactionId, a1 });
    Atomics.wait(int32View, 0, 0);
    const byteLength = int32View[1];
    if (byteLength === 0) return { values: null, error: { core_error: 'Error in get cells a1 length' } };

    const id = int32View[2];

    // New shared buffer, which is sized to hold the cells string
    sharedBuffer = new SharedArrayBuffer(4 + byteLength);
    int32View = new Int32Array(sharedBuffer, 0, 1);
    Atomics.store(int32View, 0, 0);

    send({ type: 'pythonCoreGetCellsA1Data', id, sharedBuffer });
    Atomics.wait(int32View, 0, 0);

    let uint8View: Uint8Array | undefined = new Uint8Array(sharedBuffer, 4, byteLength);

    // Copy the data to a non-shared buffer, for decoding
    const nonSharedBuffer = new ArrayBuffer(uint8View.byteLength);
    const nonSharedView = new Uint8Array(nonSharedBuffer);
    nonSharedView.set(uint8View);
    sharedBuffer = undefined;
    int32View = undefined;
    uint8View = undefined;

    const response = fromUint8Array<JsCellsA1Response>(nonSharedView);
    return response;
  } catch (e) {
    console.warn('[pythonCoreSAB] getCellsA1 error', e);
  }
  return { values: null, error: { core_error: 'Error parsing getCellsA1 response' } };
}
