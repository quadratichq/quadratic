/**
 * Async (non-SAB) implementation for Python cell access.
 *
 * This uses Promises and postMessage to get cell data from the core worker.
 * It's used when SharedArrayBuffer is not available.
 */

import type { JsCellsA1Response } from '@/app/quadratic-core-types';

// Pending requests waiting for responses
const pendingRequests = new Map<number, (response: JsCellsA1Response) => void>();
let nextRequestId = 0;

/**
 * Get cells using async message passing (returns Promise)
 */
export function sendGetCellsA1Async(
  send: (message: any) => void,
  transactionId: string,
  a1: string
): Promise<JsCellsA1Response> {
  return new Promise((resolve) => {
    const requestId = nextRequestId++;
    pendingRequests.set(requestId, resolve);
    send({ type: 'pythonCoreGetCellsA1Async', requestId, transactionId, a1 });
  });
}

/**
 * Handle response from core worker for async cell request.
 * This is called by the message handler when a response arrives.
 */
export function handleCellsAsyncResponse(requestId: number, response: JsCellsA1Response): void {
  const resolve = pendingRequests.get(requestId);
  if (resolve) {
    pendingRequests.delete(requestId);
    resolve(response);
  } else {
    console.warn('[pythonCoreAsync] No pending request for id:', requestId);
  }
}

/**
 * Check if there are pending async requests
 */
export function hasPendingRequests(): boolean {
  return pendingRequests.size > 0;
}
