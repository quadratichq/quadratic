/**
 * RustLayoutWasm handles the WASM layout engine lifecycle and API.
 *
 * Responsibilities:
 * - Initialize the WASM module
 * - Load fonts directly (no client transfer)
 * - Provide API for layout operations
 * - Generate render batches for the render worker
 */

import init, { LayoutWorker } from '../layout-pkg/quadratic_rust_layout.js';
import { startFontLoading } from '../worker/rustRendererFontLoader';

class RustLayoutWasm {
  private worker?: LayoutWorker;
  private initialized = false;

  /**
   * Initialize the WASM module and layout worker.
   * Loads fonts in parallel with WASM initialization.
   */
  async init(viewportBuffer: SharedArrayBuffer): Promise<void> {
    console.log('[rustLayoutWasm] Initializing...');

    // Load fonts and WASM in parallel
    const [fontResult] = await Promise.all([startFontLoading(), init()]);

    // Create the layout worker
    this.worker = new LayoutWorker();

    // Set viewport buffer
    this.worker.set_viewport_buffer(viewportBuffer);

    // Load fonts into the layout worker
    for (const font of fontResult.fonts) {
      try {
        this.worker.add_font(font.fntContent);
        console.log(`[rustLayoutWasm] Loaded font: ${font.fontName}`);
      } catch (error) {
        console.error(`[rustLayoutWasm] Failed to load font ${font.fontName}:`, error);
      }
    }

    // Start the worker
    this.worker.start();
    this.initialized = true;

    console.log(`[rustLayoutWasm] Initialized with ${fontResult.fonts.length} fonts`);
  }

  /**
   * Handle bincode message from core worker.
   */
  handleCoreMessage(data: Uint8Array): void {
    if (!this.worker || !this.initialized) {
      console.warn('[rustLayoutWasm] Received core message before initialization');
      return;
    }
    this.worker.handle_core_message(data);
  }

  /**
   * Set a new viewport buffer (when ViewportControls provides its buffer).
   */
  setViewportBuffer(buffer: SharedArrayBuffer): void {
    if (!this.worker || !this.initialized) {
      console.warn('[rustLayoutWasm] Cannot set viewport buffer - not initialized');
      return;
    }
    console.log('[rustLayoutWasm] Setting new viewport buffer');
    this.worker.set_viewport_buffer(buffer);
  }

  /**
   * Sync viewport state from SharedArrayBuffer.
   */
  syncViewport(): boolean {
    if (!this.worker || !this.initialized) return false;
    return this.worker.sync_viewport();
  }

  /**
   * Request any needed hashes from core.
   */
  requestNeededHashes(): void {
    if (!this.worker || !this.initialized) return;
    this.worker.request_needed_hashes();
  }

  /**
   * Generate render batch.
   * Returns Uint8Array that can be transferred to render worker.
   */
  update(): Uint8Array | null {
    if (!this.worker || !this.initialized) return null;
    const result = this.worker.update();
    return result ?? null;
  }

  /**
   * Resize the viewport.
   */
  resize(width: number, height: number, devicePixelRatio: number): void {
    // Viewport is managed via SharedArrayBuffer, so this is informational
    console.log(`[rustLayoutWasm] Resize: ${width}x${height} @ ${devicePixelRatio}x`);
  }

  /**
   * Set cursor position.
   */
  setCursor(col: number, row: number): void {
    if (!this.worker || !this.initialized) return;
    this.worker.set_cursor(BigInt(col), BigInt(row));
  }

  /**
   * Set selection range.
   */
  setSelection(startCol: number, startRow: number, endCol: number, endRow: number): void {
    if (!this.worker || !this.initialized) return;
    this.worker.set_cursor_selection(BigInt(startCol), BigInt(startRow), BigInt(endCol), BigInt(endRow));
  }

  /**
   * Show or hide headings.
   */
  setShowHeadings(show: boolean): void {
    if (!this.worker || !this.initialized) return;
    this.worker.set_show_headings(show);
  }

  /**
   * Get column max width for auto-sizing.
   */
  getColumnMaxWidth(column: number): number {
    if (!this.worker || !this.initialized) return 0;
    return this.worker.get_column_max_width(BigInt(column));
  }

  /**
   * Get row max height for auto-sizing.
   */
  getRowMaxHeight(row: number): number {
    if (!this.worker || !this.initialized) return 0;
    return this.worker.get_row_max_height(BigInt(row));
  }

  /**
   * Get heading dimensions.
   */
  getHeadingDimensions(): { width: number; height: number } {
    if (!this.worker || !this.initialized) return { width: 0, height: 0 };
    return {
      width: this.worker.get_heading_width(),
      height: this.worker.get_heading_height(),
    };
  }
}

export const rustLayoutWasm = new RustLayoutWasm();
