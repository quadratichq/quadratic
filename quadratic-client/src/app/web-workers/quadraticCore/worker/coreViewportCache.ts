/**
 * Viewport cache for non-SharedArrayBuffer mode.
 *
 * When SharedArrayBuffer is not available, the client sends viewport updates
 * to the core worker, which caches them here. When Rust needs the viewport,
 * it calls jsGetViewport() which returns the cached value.
 */

import type { Pos } from '@/app/quadratic-core-types';

interface CachedViewport {
  topLeft: Pos;
  bottomRight: Pos;
  sheetId: string;
}

let cachedViewport: CachedViewport | null = null;

/**
 * Update the cached viewport. Called when receiving viewport updates from client.
 */
export function updateCachedViewport(topLeft: Pos, bottomRight: Pos, sheetId: string): void {
  cachedViewport = { topLeft, bottomRight, sheetId };
}

/**
 * Get the cached viewport. Returns null if no viewport has been received yet.
 */
export function getCachedViewport(): CachedViewport | null {
  return cachedViewport;
}

/**
 * Clear the cached viewport.
 */
export function clearCachedViewport(): void {
  cachedViewport = null;
}
