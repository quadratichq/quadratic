/**
 * ViewportBuffer - SharedArrayBuffer for viewport synchronization
 *
 * This class manages the SharedArrayBuffer used to communicate viewport
 * state between the main thread and the Rust renderer worker using a
 * ping-pong double-buffering pattern.
 *
 * Buffer Layout matches viewport.rs:
 *
 * ViewportSlice (56 bytes each):
 *   [0]  flag          - i32: 0 = uninitialized, 1 = ready to read, 2 = locked
 *   [4]  top_left_x    - i32: Top-left hash position X
 *   [8]  top_left_y    - i32: Top-left hash position Y
 *   [12] bottom_right_x - i32: Bottom-right hash position X
 *   [16] bottom_right_y - i32: Bottom-right hash position Y
 *   [20] sheet_id      - [u8; 36]: UUID string bytes
 *
 * ViewportData (112 bytes total):
 *   [0-55]   slice_a
 *   [56-111] slice_b
 */

/** Size of a single viewport slice in bytes */
export const VIEWPORT_SLICE_SIZE = 56;

/** Size of the complete viewport buffer in bytes (two slices) */
export const VIEWPORT_BUFFER_SIZE = 112;

/** Byte offsets within a ViewportSlice */
export const enum SliceOffset {
  Flag = 0,
  TopLeftX = 4,
  TopLeftY = 8,
  BottomRightX = 12,
  BottomRightY = 16,
  SheetId = 20,
}

/** Flag values for slice state */
export const enum SliceFlag {
  Uninitialized = 0,
  Ready = 1,
  Locked = 2,
}

/** Viewport state read from the buffer */
export interface ViewportState {
  topLeft: { x: number; y: number };
  bottomRight: { x: number; y: number };
  sheetId: string;
}

/**
 * ViewportBuffer class for reading and writing viewport data
 * using a SharedArrayBuffer with ping-pong double-buffering.
 */
export class ViewportBuffer {
  private buffer: SharedArrayBuffer;
  private int32View: Int32Array;
  private uint8View: Uint8Array;
  private writeSlice: 0 | 1 = 0;

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
    this.uint8View = new Uint8Array(this.buffer);
  }

  /** Get the underlying SharedArrayBuffer */
  getBuffer(): SharedArrayBuffer {
    return this.buffer;
  }

  /**
   * Get the byte offset for a slice (0 or 1).
   */
  private sliceByteOffset(slice: 0 | 1): number {
    return slice * VIEWPORT_SLICE_SIZE;
  }

  /**
   * Get the i32 index for the flag of a slice.
   */
  private flagIndex(slice: 0 | 1): number {
    return (this.sliceByteOffset(slice) + SliceOffset.Flag) / 4;
  }

  /**
   * Write viewport data to the next available slice (ping-pong pattern).
   * This is called by the writer (main thread).
   *
   * @param topLeft - Top-left position
   * @param bottomRight - Bottom-right position
   * @param sheetId - UUID string (must be exactly 36 characters)
   */
  write(
    topLeft: { x: number; y: number },
    bottomRight: { x: number; y: number },
    sheetId: string
  ): void {
    if (sheetId.length !== 36) {
      throw new Error(
        `Invalid sheetId length: expected 36, got ${sheetId.length}`
      );
    }

    const slice = this.writeSlice;
    const byteOffset = this.sliceByteOffset(slice);
    const i32Offset = byteOffset / 4;

    // Write the position data
    this.int32View[i32Offset + SliceOffset.TopLeftX / 4] = topLeft.x;
    this.int32View[i32Offset + SliceOffset.TopLeftY / 4] = topLeft.y;
    this.int32View[i32Offset + SliceOffset.BottomRightX / 4] = bottomRight.x;
    this.int32View[i32Offset + SliceOffset.BottomRightY / 4] = bottomRight.y;

    // Write the sheetId as UTF-8 bytes
    const sheetIdBytes = new TextEncoder().encode(sheetId);
    this.uint8View.set(sheetIdBytes, byteOffset + SliceOffset.SheetId);

    // Mark slice as ready (atomic store)
    Atomics.store(this.int32View, this.flagIndex(slice), SliceFlag.Ready);

    // Toggle to the other slice for next write
    this.writeSlice = slice === 0 ? 1 : 0;
  }

  /**
   * Try to read viewport data from the buffer.
   * This is called by the reader (worker thread).
   *
   * Uses atomic operations for thread-safe access.
   *
   * @returns The viewport state if available, or null if no slice is ready
   */
  read(): ViewportState | null {
    // Try slice A first, then slice B
    for (const slice of [0, 1] as const) {
      const result = this.tryReadSlice(slice);
      if (result !== null) {
        return result;
      }
    }
    return null;
  }

  /**
   * Try to lock and read a specific slice.
   * Returns null if the slice is not ready or couldn't be locked.
   */
  private tryReadSlice(slice: 0 | 1): ViewportState | null {
    const flagIdx = this.flagIndex(slice);

    // Check if slice is ready (flag === 1)
    const currentFlag = Atomics.load(this.int32View, flagIdx);
    if (currentFlag !== SliceFlag.Ready) {
      return null;
    }

    // Try to acquire lock: compare-exchange 1 -> 2
    const exchangeResult = Atomics.compareExchange(
      this.int32View,
      flagIdx,
      SliceFlag.Ready,
      SliceFlag.Locked
    );

    if (exchangeResult !== SliceFlag.Ready) {
      // Someone else grabbed it
      return null;
    }

    // Successfully locked, read the data
    const byteOffset = this.sliceByteOffset(slice);
    const i32Offset = byteOffset / 4;

    const topLeft = {
      x: this.int32View[i32Offset + SliceOffset.TopLeftX / 4],
      y: this.int32View[i32Offset + SliceOffset.TopLeftY / 4],
    };
    const bottomRight = {
      x: this.int32View[i32Offset + SliceOffset.BottomRightX / 4],
      y: this.int32View[i32Offset + SliceOffset.BottomRightY / 4],
    };

    // Read sheetId from bytes
    const sheetIdBytes = this.uint8View.slice(
      byteOffset + SliceOffset.SheetId,
      byteOffset + SliceOffset.SheetId + 36
    );
    const sheetId = new TextDecoder().decode(sheetIdBytes);

    // Release lock: set flag back to 1 (ready)
    Atomics.store(this.int32View, flagIdx, SliceFlag.Ready);

    return { topLeft, bottomRight, sheetId };
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
}
