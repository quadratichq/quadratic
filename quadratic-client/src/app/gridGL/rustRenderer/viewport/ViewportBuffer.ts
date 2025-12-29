/**
 * ViewportBuffer - SharedArrayBuffer for viewport synchronization
 *
 * This module manages the SharedArrayBuffer used to communicate viewport
 * state from the main thread to the Rust renderer worker.
 *
 * Buffer Layout (Float32Array, 8 floats = 32 bytes):
 *   [0] positionX   - Viewport X position in world coordinates
 *   [1] positionY   - Viewport Y position in world coordinates
 *   [2] scale       - Zoom level (1.0 = 100%)
 *   [3] dpr         - Device pixel ratio
 *   [4] width       - Viewport width in device pixels
 *   [5] height      - Viewport height in device pixels
 *   [6] dirty       - Dirty flag (1.0 = dirty, 0.0 = clean)
 *   [7] reserved    - Reserved for future use
 */

/** Size of the viewport buffer in bytes */
export const VIEWPORT_BUFFER_SIZE = 32; // 8 floats * 4 bytes each

/** Indices into the Float32Array */
export const enum ViewportBufferIndex {
  PositionX = 0,
  PositionY = 1,
  Scale = 2,
  Dpr = 3,
  Width = 4,
  Height = 5,
  Dirty = 6,
  Reserved = 7,
}

/**
 * Create a new SharedArrayBuffer for viewport synchronization.
 *
 * @returns A new SharedArrayBuffer of the correct size
 */
export function createViewportBuffer(): SharedArrayBuffer {
  const buffer = new SharedArrayBuffer(VIEWPORT_BUFFER_SIZE);

  // Initialize with default values
  const view = new Float32Array(buffer);
  view[ViewportBufferIndex.PositionX] = 0;
  view[ViewportBufferIndex.PositionY] = 0;
  view[ViewportBufferIndex.Scale] = 1.0;
  view[ViewportBufferIndex.Dpr] = 1.0;
  view[ViewportBufferIndex.Width] = 0;
  view[ViewportBufferIndex.Height] = 0;
  view[ViewportBufferIndex.Dirty] = 1.0; // Start dirty
  view[ViewportBufferIndex.Reserved] = 0;

  return buffer;
}

/**
 * Read viewport state from a SharedArrayBuffer.
 *
 * This is used by the Rust renderer to read the current viewport state.
 */
export interface ViewportState {
  positionX: number;
  positionY: number;
  scale: number;
  dpr: number;
  width: number;
  height: number;
  dirty: boolean;
}

/**
 * Read the viewport state from a SharedArrayBuffer.
 *
 * @param buffer - The SharedArrayBuffer containing viewport data
 * @returns The current viewport state
 */
export function readViewportBuffer(buffer: SharedArrayBuffer): ViewportState {
  const view = new Float32Array(buffer);

  return {
    positionX: view[ViewportBufferIndex.PositionX],
    positionY: view[ViewportBufferIndex.PositionY],
    scale: view[ViewportBufferIndex.Scale],
    dpr: view[ViewportBufferIndex.Dpr],
    width: view[ViewportBufferIndex.Width],
    height: view[ViewportBufferIndex.Height],
    dirty: view[ViewportBufferIndex.Dirty] !== 0,
  };
}

/**
 * Write viewport state to a SharedArrayBuffer.
 *
 * @param buffer - The SharedArrayBuffer to write to
 * @param state - The viewport state to write
 */
export function writeViewportBuffer(
  buffer: SharedArrayBuffer,
  state: Partial<ViewportState>
): void {
  const view = new Float32Array(buffer);

  if (state.positionX !== undefined)
    view[ViewportBufferIndex.PositionX] = state.positionX;
  if (state.positionY !== undefined)
    view[ViewportBufferIndex.PositionY] = state.positionY;
  if (state.scale !== undefined) view[ViewportBufferIndex.Scale] = state.scale;
  if (state.dpr !== undefined) view[ViewportBufferIndex.Dpr] = state.dpr;
  if (state.width !== undefined) view[ViewportBufferIndex.Width] = state.width;
  if (state.height !== undefined)
    view[ViewportBufferIndex.Height] = state.height;
  if (state.dirty !== undefined)
    view[ViewportBufferIndex.Dirty] = state.dirty ? 1.0 : 0.0;
}

/**
 * Mark the viewport as dirty in the buffer.
 *
 * @param buffer - The SharedArrayBuffer
 */
export function markViewportDirty(buffer: SharedArrayBuffer): void {
  const view = new Float32Array(buffer);
  view[ViewportBufferIndex.Dirty] = 1.0;
}

/**
 * Mark the viewport as clean in the buffer.
 *
 * @param buffer - The SharedArrayBuffer
 */
export function markViewportClean(buffer: SharedArrayBuffer): void {
  const view = new Float32Array(buffer);
  view[ViewportBufferIndex.Dirty] = 0.0;
}

/**
 * Check if the viewport is dirty.
 *
 * @param buffer - The SharedArrayBuffer
 * @returns true if the viewport is dirty
 */
export function isViewportDirty(buffer: SharedArrayBuffer): boolean {
  const view = new Float32Array(buffer);
  return view[ViewportBufferIndex.Dirty] !== 0;
}
