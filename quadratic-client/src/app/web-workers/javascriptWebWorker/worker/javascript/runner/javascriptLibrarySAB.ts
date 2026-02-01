/**
 * SharedArrayBuffer implementation of q.cells() for JavaScript.
 *
 * This implementation uses SharedArrayBuffer and Atomics.wait() to
 * synchronously block until cell data is available from the core worker.
 *
 * This is used when SharedArrayBuffer is available (cross-origin isolated context).
 */

import { lineNumber, parseCellsResponse, type CellType } from './javascriptLibraryShared';

declare var self: WorkerGlobalScope & typeof globalThis;

/**
 * Get cells using SharedArrayBuffer and Atomics.wait (synchronous/blocking)
 */
export function cellsSAB(a1: string): CellType | CellType[] | CellType[][] {
  if (typeof a1 !== 'string') {
    const line = lineNumber();

    throw new Error(
      'q.cell requires at least 1 argument, received q.cell(' +
        a1 +
        ')' +
        (line !== undefined ? ' at line ' + (line - 1) : '')
    );
  }

  // This is a shared buffer that will be used to communicate with core
  // The first 4 bytes are used to signal the python core that the data is ready
  // The second 4 bytes are used to signal the length of the data
  // The third 4 bytes are used to signal the id of the data
  // Length of the cells string is unknown at this point
  let sharedBuffer: SharedArrayBuffer | undefined = new SharedArrayBuffer(4 + 4 + 4);
  let int32View: Int32Array | undefined = new Int32Array(sharedBuffer, 0, 3);
  Atomics.store(int32View, 0, 0);

  self.postMessage({ type: 'getCellsA1Length', sharedBuffer, a1 });
  Atomics.wait(int32View, 0, 0);
  const byteLength = int32View[1];
  if (byteLength === 0) throw new Error('Error in get cells a1 length');

  const id = int32View[2];

  // New shared buffer, which is sized to hold the cells string
  sharedBuffer = new SharedArrayBuffer(4 + byteLength);
  int32View = new Int32Array(sharedBuffer, 0, 1);
  Atomics.store(int32View, 0, 0);

  self.postMessage({ type: 'getCellsData', id, sharedBuffer });
  Atomics.wait(int32View, 0, 0);

  let uint8View: Uint8Array | undefined = new Uint8Array(sharedBuffer, 4, byteLength);

  // Copy the data to a non-shared buffer, for decoding
  const nonSharedBuffer = new ArrayBuffer(uint8View.byteLength);
  const nonSharedView = new Uint8Array(nonSharedBuffer);
  nonSharedView.set(uint8View);
  sharedBuffer = undefined;
  int32View = undefined;
  uint8View = undefined;

  const decoder = new TextDecoder();
  const resultsStringified = decoder.decode(nonSharedView);
  const results = JSON.parse(resultsStringified);

  return parseCellsResponse(results);
}
