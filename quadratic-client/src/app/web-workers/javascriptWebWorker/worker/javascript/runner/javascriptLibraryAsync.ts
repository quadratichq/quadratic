/**
 * Async (non-SAB) implementation of q.cells() for JavaScript.
 *
 * This implementation uses Promises and postMessage to get cell data
 * from the core worker. It's used when SharedArrayBuffer is not available.
 *
 * User code is transformed to add `await` before q.cells() calls,
 * so this Promise-based approach works transparently.
 */

import { lineNumber, parseCellsResponse, type CellType } from './javascriptLibraryShared';

declare var self: WorkerGlobalScope & typeof globalThis;

// Pending requests waiting for responses
const pendingRequests = new Map<
  number,
  {
    resolve: (value: CellType | CellType[] | CellType[][]) => void;
    reject: (error: Error) => void;
  }
>();
let nextRequestId = 0;

/**
 * Get cells using async message passing (returns Promise)
 */
export function cellsAsync(a1: string): Promise<CellType | CellType[] | CellType[][]> {
  if (typeof a1 !== 'string') {
    const line = lineNumber();
    return Promise.reject(
      new Error(
        'q.cell requires at least 1 argument, received q.cell(' +
          a1 +
          ')' +
          (line !== undefined ? ' at line ' + (line - 1) : '')
      )
    );
  }

  return new Promise((resolve, reject) => {
    const requestId = nextRequestId++;
    pendingRequests.set(requestId, { resolve, reject });
    self.postMessage({ type: 'getCellsA1Async', requestId, a1 });
  });
}

/**
 * Handle response from core worker for async cell request.
 * This is called by the message handler when a response arrives.
 */
export function handleCellsAsyncResponse(requestId: number, resultsStringified: string | null, error?: string): void {
  const pending = pendingRequests.get(requestId);
  if (!pending) {
    console.warn('[javascriptLibraryAsync] No pending request for id:', requestId);
    return;
  }

  pendingRequests.delete(requestId);

  if (error) {
    pending.reject(new Error(error));
    return;
  }

  if (!resultsStringified) {
    pending.reject(new Error('Empty response from core'));
    return;
  }

  try {
    const results = JSON.parse(resultsStringified);
    const parsed = parseCellsResponse(results);
    pending.resolve(parsed);
  } catch (e) {
    pending.reject(e instanceof Error ? e : new Error(String(e)));
  }
}

/**
 * Check if there are pending async requests
 */
export function hasPendingRequests(): boolean {
  return pendingRequests.size > 0;
}
