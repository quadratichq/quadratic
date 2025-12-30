/**
 * ViewportBuffer - SharedArrayBuffer for viewport synchronization
 *
 * This class manages the SharedArrayBuffer used to communicate viewport
 * state between the main thread and the Rust renderer worker using a
 * ping-pong double-buffering pattern.
 *
 * This is a UNIFIED viewport buffer shared by:
 * - Client (TypeScript) - the ONLY writer
 * - Renderer (quadratic-rust-renderer) - reads for GPU rendering
 * - Core (quadratic-core) - reads to compute visible hash bounds
 *
 * Buffer Layout (two slices for ping-pong pattern):
 *
 * ViewportSlice (72 bytes each):
 *   [0]  flag       - i32: 0 = uninitialized, 1 = ready to read, 2 = locked for reading
 *   [4]  positionX  - f32: Viewport X position in world coordinates
 *   [8]  positionY  - f32: Viewport Y position in world coordinates
 *   [12] scale      - f32: Zoom level (1.0 = 100%)
 *   [16] dpr        - f32: Device pixel ratio
 *   [20] width      - f32: Viewport width in device pixels
 *   [24] height     - f32: Viewport height in device pixels
 *   [28] dirty      - f32: Dirty flag (1.0 = dirty, 0.0 = clean)
 *   [32] reserved   - f32: Reserved for future use
 *   [36] sheetId    - [u8; 36]: UUID string bytes
 *
 * ViewportData (144 bytes total):
 *   [0-71]   slice_a
 *   [72-143] slice_b
 */

/** Size of the sheet_id field in bytes (UUID string) */
export const SHEET_ID_SIZE = 36;

/** Size of a single viewport slice in bytes */
export const VIEWPORT_SLICE_SIZE = 72; // 1 i32 + 8 f32 + 36 bytes = 72 bytes

/** Size of the viewport buffer in bytes (two slices) */
export const VIEWPORT_BUFFER_SIZE = 144; // 72 * 2

/** Flag values for slice state */
export const enum SliceFlag {
  Uninitialized = 0,
  Ready = 1,
  Locked = 2,
}

/** Byte offsets within a ViewportSlice */
export const enum SliceOffset {
  Flag = 0,
  PositionX = 4,
  PositionY = 8,
  Scale = 12,
  Dpr = 16,
  Width = 20,
  Height = 24,
  Dirty = 28,
  Reserved = 32,
  SheetId = 36, // 36 bytes for UUID string
}

/** Float offsets within a ViewportSlice (starting after the i32 flag) */
export const enum FloatIndex {
  PositionX = 0,
  PositionY = 1,
  Scale = 2,
  Dpr = 3,
  Width = 4,
  Height = 5,
  Dirty = 6,
  Reserved = 7,
}

/** Viewport state */
export interface ViewportState {
  positionX: number;
  positionY: number;
  scale: number;
  dpr: number;
  width: number;
  height: number;
  dirty: boolean;
  sheetId: string;
}

/**
 * ViewportBuffer class for reading and writing viewport data
 * using a SharedArrayBuffer with ping-pong double-buffering.
 */
export class ViewportBuffer {
  private buffer: SharedArrayBuffer;
  private int32View: Int32Array;
  private float32View: Float32Array;
  private uint8View: Uint8Array;
  private writeSlice: 0 | 1 = 0;
  private textEncoder: TextEncoder;

  /**
   * Create a ViewportBuffer from an existing SharedArrayBuffer
   * or create a new one if not provided.
   */
  constructor(buffer?: SharedArrayBuffer) {
    if (buffer) {
      if (buffer.byteLength !== VIEWPORT_BUFFER_SIZE) {
        throw new Error(
          `Invalid buffer size: expected ${VIEWPORT_BUFFER_SIZE}, got ${buffer.byteLength}`
        );
      }
      this.buffer = buffer;
    } else {
      this.buffer = new SharedArrayBuffer(VIEWPORT_BUFFER_SIZE);
    }
    this.int32View = new Int32Array(this.buffer);
    this.float32View = new Float32Array(this.buffer);
    this.uint8View = new Uint8Array(this.buffer);
    this.textEncoder = new TextEncoder();
  }

  /** Get the underlying SharedArrayBuffer */
  getBuffer(): SharedArrayBuffer {
    return this.buffer;
  }

  /**
   * Get the flag index (in i32 units) for a slice.
   */
  private flagIndex(slice: 0 | 1): number {
    return (slice * VIEWPORT_SLICE_SIZE) / 4;
  }

  /**
   * Get the float offset (in f32 units) for a slice's data.
   * The flag takes up 1 i32 (4 bytes), so floats start at byte 4 of the slice.
   */
  private floatOffset(slice: 0 | 1): number {
    return (slice * VIEWPORT_SLICE_SIZE) / 4 + 1;
  }

  /**
   * Get the byte offset for the sheetId field in a slice.
   */
  private sheetIdByteOffset(slice: 0 | 1): number {
    return slice * VIEWPORT_SLICE_SIZE + SliceOffset.SheetId;
  }

  /**
   * Write the sheetId string to a slice.
   */
  private writeSheetId(slice: 0 | 1, sheetId: string): void {
    const offset = this.sheetIdByteOffset(slice);
    const encoded = this.textEncoder.encode(sheetId);
    for (let i = 0; i < SHEET_ID_SIZE; i++) {
      this.uint8View[offset + i] = i < encoded.length ? encoded[i] : 0;
    }
  }

  /**
   * Write all viewport state values at once.
   */
  writeAll(
    positionX: number,
    positionY: number,
    scale: number,
    dpr: number,
    width: number,
    height: number,
    dirty: boolean,
    sheetId: string
  ): void {
    const slice = this.writeSlice;
    const flagIdx = this.flagIndex(slice);
    const floatOffset = this.floatOffset(slice);

    // Check if the current slice is locked - if so, try the other slice
    let targetFlagIdx = flagIdx;
    let targetFloatOffset = floatOffset;
    let targetSlice = slice;

    const currentFlag = Atomics.load(this.int32View, flagIdx);
    if (currentFlag === SliceFlag.Locked) {
      const otherSlice = slice === 0 ? 1 : 0;
      const otherFlagIdx = this.flagIndex(otherSlice);
      const otherFlag = Atomics.load(this.int32View, otherFlagIdx);

      if (otherFlag !== SliceFlag.Locked) {
        targetSlice = otherSlice;
        targetFlagIdx = otherFlagIdx;
        targetFloatOffset = this.floatOffset(otherSlice);
      }
    }

    // Mark slice as being written
    Atomics.store(this.int32View, targetFlagIdx, SliceFlag.Uninitialized);

    // Write all data
    this.float32View[targetFloatOffset + FloatIndex.PositionX] = positionX;
    this.float32View[targetFloatOffset + FloatIndex.PositionY] = positionY;
    this.float32View[targetFloatOffset + FloatIndex.Scale] = scale;
    this.float32View[targetFloatOffset + FloatIndex.Dpr] = dpr;
    this.float32View[targetFloatOffset + FloatIndex.Width] = width;
    this.float32View[targetFloatOffset + FloatIndex.Height] = height;
    this.float32View[targetFloatOffset + FloatIndex.Dirty] = dirty ? 1.0 : 0.0;
    this.float32View[targetFloatOffset + FloatIndex.Reserved] = 0;
    this.writeSheetId(targetSlice as 0 | 1, sheetId);

    // Mark slice as ready
    Atomics.store(this.int32View, targetFlagIdx, SliceFlag.Ready);

    // Toggle for next write
    this.writeSlice = targetSlice === 0 ? 1 : 0;
  }

  /**
   * Try to read viewport data from the buffer.
   *
   * @returns The viewport state if available, or null if no slice is ready
   */
  read(): ViewportState | null {
    const textDecoder = new TextDecoder();

    // Try slice A first, then slice B
    for (const slice of [0, 1] as const) {
      const flagIdx = this.flagIndex(slice);
      const floatOffset = this.floatOffset(slice);
      const sheetIdOffset = this.sheetIdByteOffset(slice);

      const flag = Atomics.load(this.int32View, flagIdx);
      if (flag === SliceFlag.Ready) {
        // Try to lock the slice
        const exchangeResult = Atomics.compareExchange(
          this.int32View,
          flagIdx,
          SliceFlag.Ready,
          SliceFlag.Locked
        );

        if (exchangeResult === SliceFlag.Ready) {
          // Successfully locked, read the data
          const sheetIdBytes = this.uint8View.slice(
            sheetIdOffset,
            sheetIdOffset + SHEET_ID_SIZE
          );
          const sheetId = textDecoder.decode(sheetIdBytes).replace(/\0+$/, '');

          const state: ViewportState = {
            positionX: this.float32View[floatOffset + FloatIndex.PositionX],
            positionY: this.float32View[floatOffset + FloatIndex.PositionY],
            scale: this.float32View[floatOffset + FloatIndex.Scale],
            dpr: this.float32View[floatOffset + FloatIndex.Dpr],
            width: this.float32View[floatOffset + FloatIndex.Width],
            height: this.float32View[floatOffset + FloatIndex.Height],
            dirty: this.float32View[floatOffset + FloatIndex.Dirty] !== 0,
            sheetId,
          };

          // Unlock the slice
          Atomics.store(this.int32View, flagIdx, SliceFlag.Ready);

          return state;
        }
      }
    }

    return null;
  }

  /**
   * Check if any slice has data ready to read.
   */
  isReady(): boolean {
    return (
      Atomics.load(this.int32View, this.flagIndex(0)) === SliceFlag.Ready ||
      Atomics.load(this.int32View, this.flagIndex(1)) === SliceFlag.Ready
    );
  }

  /**
   * Reset both slices to uninitialized state.
   */
  reset(): void {
    Atomics.store(this.int32View, this.flagIndex(0), SliceFlag.Uninitialized);
    Atomics.store(this.int32View, this.flagIndex(1), SliceFlag.Uninitialized);
    this.writeSlice = 0;
  }

  /**
   * Mark the viewport as dirty in both slices.
   */
  markDirty(): void {
    this.float32View[this.floatOffset(0) + FloatIndex.Dirty] = 1.0;
    this.float32View[this.floatOffset(1) + FloatIndex.Dirty] = 1.0;
  }

  /**
   * Mark the viewport as clean in both slices.
   */
  markClean(): void {
    this.float32View[this.floatOffset(0) + FloatIndex.Dirty] = 0.0;
    this.float32View[this.floatOffset(1) + FloatIndex.Dirty] = 0.0;
  }
}

/**
 * Create a new SharedArrayBuffer for viewport synchronization.
 *
 * @param sheetId - The initial sheet ID (36-character UUID string)
 * @returns A new SharedArrayBuffer of the correct size, initialized with default values
 */
export function createViewportBuffer(sheetId: string = ''): SharedArrayBuffer {
  const viewportBuffer = new ViewportBuffer();

  // Initialize with default values in both slices
  viewportBuffer.writeAll(0, 0, 1.0, 1.0, 0, 0, true, sheetId);
  viewportBuffer.writeAll(0, 0, 1.0, 1.0, 0, 0, true, sheetId);

  return viewportBuffer.getBuffer();
}

/**
 * Read the viewport state from a SharedArrayBuffer (for debugging/testing).
 */
export function readViewportBuffer(buffer: SharedArrayBuffer): ViewportState | null {
  const viewportBuffer = new ViewportBuffer(buffer);
  return viewportBuffer.read();
}

/**
 * @deprecated Use ViewportBuffer.write() instead
 */
export function writeViewportBuffer(buffer: SharedArrayBuffer, state: Partial<ViewportState>): void {
  const viewportBuffer = new ViewportBuffer(buffer);
  if (
    state.positionX !== undefined &&
    state.positionY !== undefined &&
    state.scale !== undefined &&
    state.dpr !== undefined &&
    state.width !== undefined &&
    state.height !== undefined &&
    state.dirty !== undefined &&
    state.sheetId !== undefined
  ) {
    viewportBuffer.writeAll(
      state.positionX,
      state.positionY,
      state.scale,
      state.dpr,
      state.width,
      state.height,
      state.dirty,
      state.sheetId
    );
  }
}

/**
 * @deprecated Use ViewportBuffer.markDirty() instead
 */
export function markViewportDirty(buffer: SharedArrayBuffer): void {
  const viewportBuffer = new ViewportBuffer(buffer);
  viewportBuffer.markDirty();
}

/**
 * @deprecated Use ViewportBuffer.markClean() instead
 */
export function markViewportClean(buffer: SharedArrayBuffer): void {
  const viewportBuffer = new ViewportBuffer(buffer);
  viewportBuffer.markClean();
}

/**
 * @deprecated Use ViewportBuffer.isReady() to check if data is available
 */
export function isViewportDirty(buffer: SharedArrayBuffer): boolean {
  const state = readViewportBuffer(buffer);
  return state?.dirty ?? false;
}
