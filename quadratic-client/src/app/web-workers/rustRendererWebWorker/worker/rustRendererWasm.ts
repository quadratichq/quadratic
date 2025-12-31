/**
 * RustRendererWasm handles the WASM module and its initialization.
 *
 * This provides a TypeScript interface to the Rust renderer compiled to WASM.
 * It manages the lifecycle of the WASM module and provides methods to interact
 * with the renderer.
 *
 * Font loading starts in the constructor to minimize startup time.
 * This means fonts begin loading as soon as the module is imported,
 * running in parallel with WASM initialization.
 */

import init, { WorkerRenderer } from '@/app/quadratic-rust-renderer/quadratic_rust_renderer';
import type { FontLoadResult } from './rustRendererFontLoader';
import { startFontLoading } from './rustRendererFontLoader';

class RustRendererWasm {
  private canvas?: OffscreenCanvas;
  private devicePixelRatio = 1;
  private initialized = false;
  private backend?: 'webgpu' | 'webgl';
  private renderer?: WorkerRenderer;

  // Buffer for messages received before initialization
  private pendingMessages: Uint8Array[] = [];

  // Font loading promise started in constructor for early loading
  private fontLoadPromise: Promise<FontLoadResult>;

  constructor() {
    // Start font loading immediately in constructor
    // This is a key optimization - fonts start loading as soon as the module is imported
    this.fontLoadPromise = startFontLoading();
  }

  /**
   * Initialize the WASM renderer with an OffscreenCanvas.
   * Font loading started in constructor runs in parallel with WASM initialization.
   * Returns the backend type being used (webgpu or webgl).
   */
  async init(canvas: OffscreenCanvas, devicePixelRatio: number): Promise<'webgpu' | 'webgl'> {
    this.canvas = canvas;
    this.devicePixelRatio = devicePixelRatio;

    // Initialize WASM module (init_wasm() is auto-called via #[wasm_bindgen(start)])
    await init();

    // Try WebGPU first, fall back to WebGL
    let renderer: WorkerRenderer;
    if (WorkerRenderer.is_webgpu_available()) {
      try {
        renderer = await WorkerRenderer.new_webgpu(canvas);
        this.backend = 'webgpu';
        console.log('[rustRendererWasm] Using WebGPU backend');
      } catch (error) {
        console.warn('[rustRendererWasm] WebGPU initialization failed, falling back to WebGL:', error);
        renderer = new WorkerRenderer(canvas);
        this.backend = 'webgl';
        console.log('[rustRendererWasm] Using WebGL backend');
      }
    } else {
      renderer = new WorkerRenderer(canvas);
      this.backend = 'webgl';
      console.log('[rustRendererWasm] Using WebGL backend (WebGPU not available)');
    }

    this.renderer = renderer;

    // Set initial size from canvas (canvas dimensions are in device pixels)
    const deviceWidth = canvas.width;
    const deviceHeight = canvas.height;
    if (deviceWidth > 0 && deviceHeight > 0) {
      // Rust renderer expects device pixels
      renderer.resize(deviceWidth, deviceHeight, devicePixelRatio);
      console.log(`[rustRendererWasm] Initial size: ${deviceWidth}x${deviceHeight} (device pixels)`);
    }

    // Wait for fonts to finish loading (started in constructor) and pass them to the renderer
    const fontLoadResult = await this.fontLoadPromise;
    this.loadFontsIntoRenderer(renderer, fontLoadResult);

    this.initialized = true;

    console.log(`[rustRendererWasm] Fonts loaded: ${renderer.has_fonts()}`);

    // Set pending viewport buffer if one was received before initialization
    if (this.pendingViewportBuffer) {
      console.log('[rustRendererWasm] Setting pending viewport buffer');
      this.renderer.set_viewport_buffer(this.pendingViewportBuffer);
      this.pendingViewportBuffer = undefined;
    }

    // Start the renderer (delayed to ensure viewport buffer can be set first)
    renderer.start();

    // Replay any messages that arrived before initialization
    this.replayPendingMessages();

    return this.backend;
  }

  /**
   * Load pre-fetched fonts into the renderer.
   * Uses add_font() which takes JSON format.
   */
  private loadFontsIntoRenderer(renderer: WorkerRenderer, fontLoadResult: FontLoadResult): void {
    for (const font of fontLoadResult.fonts) {
      // Add font using JSON format
      try {
        renderer.add_font(font.fntContent);
      } catch (error) {
        console.warn(`[rustRendererWasm] Failed to load font ${font.fontName}:`, error);
        continue;
      }

      // Upload texture pages
      for (const texture of font.textures) {
        try {
          renderer.upload_font_texture_from_data(texture.textureUid, texture.width, texture.height, texture.rgbaData);
        } catch (error) {
          console.warn(`[rustRendererWasm] Failed to upload texture ${texture.textureUid}:`, error);
        }
      }
    }
  }

  /**
   * Handle a bincode message from the core worker.
   * This is forwarded directly to the WASM renderer for decoding.
   * Messages received before initialization are queued and replayed.
   */
  handleCoreMessage(data: Uint8Array) {
    if (!this.initialized || !this.renderer) {
      // Queue the message for later - make a copy since the buffer may be transferred
      console.log(`[rustRendererWasm] Queueing core message (${data.length} bytes) - not yet initialized`);
      this.pendingMessages.push(new Uint8Array(data));
      return;
    }

    console.log(`[rustRendererWasm] Received core message (${data.length} bytes)`);

    // Forward the bincode message to the WASM renderer
    this.renderer.handle_core_message(data);
  }

  /**
   * Replay any messages that were queued before initialization.
   */
  private replayPendingMessages() {
    if (this.pendingMessages.length === 0) return;

    console.log(`[rustRendererWasm] Replaying ${this.pendingMessages.length} queued message(s)`);

    for (const data of this.pendingMessages) {
      console.log(`[rustRendererWasm] Replaying queued message (${data.length} bytes)`);
      this.renderer?.handle_core_message(data);
    }

    this.pendingMessages = [];
  }

  // Note: Ready message is now sent automatically from WASM when renderer.start() is called

  /**
   * Update the viewport (visible area and scale).
   * Note: The renderer now manages viewport internally via SharedArrayBuffer.
   * This message is for fallback/debugging - the SharedArrayBuffer is the primary sync mechanism.
   */
  updateViewport(sheetId: string, bounds: { x: number; y: number; width: number; height: number }, scale: number) {
    if (!this.initialized || !this.renderer) return;

    // Just mark dirty - viewport state comes from SharedArrayBuffer
    this.renderer.set_viewport_dirty();
  }

  /**
   * Switch to a different sheet.
   */
  setSheet(sheetId: string) {
    if (!this.initialized || !this.renderer) return;

    // TODO: Implement sheet switching when we have multi-sheet support
    console.log(`[rustRendererWasm] setSheet: ${sheetId} (not yet implemented)`);
  }

  /**
   * Resize the canvas.
   * @param width - CSS width (logical pixels)
   * @param height - CSS height (logical pixels)
   * @param devicePixelRatio - Device pixel ratio
   */
  resize(width: number, height: number, devicePixelRatio: number) {
    if (!this.initialized || !this.canvas || !this.renderer) return;

    this.devicePixelRatio = devicePixelRatio;

    // Canvas dimensions are in device pixels
    const deviceWidth = Math.round(width * devicePixelRatio);
    const deviceHeight = Math.round(height * devicePixelRatio);
    this.canvas.width = deviceWidth;
    this.canvas.height = deviceHeight;

    // Rust renderer expects device pixels
    this.renderer.resize(deviceWidth, deviceHeight, devicePixelRatio);
  }

  /**
   * Take a screenshot of the current render.
   */
  async screenshot(): Promise<{ imageData: Uint8Array; width: number; height: number }> {
    if (!this.initialized || !this.canvas) {
      return { imageData: new Uint8Array(0), width: 0, height: 0 };
    }

    // TODO: Implement screenshot in Rust
    // return this.renderer?.screenshot();

    // Placeholder: return empty screenshot
    return {
      imageData: new Uint8Array(0),
      width: this.canvas.width,
      height: this.canvas.height,
    };
  }

  // Frame counter for periodic logging
  private frameCount = 0;

  /**
   * Render a frame.
   * @param elapsed Time since last frame in milliseconds
   * @returns true if a render occurred
   */
  frame(elapsed: number): boolean {
    if (!this.initialized || !this.renderer) return false;
    this.frameCount++;
    return this.renderer.frame(elapsed);
  }

  /**
   * Set the A1Selection from bincode-encoded bytes.
   * This is kept in sync with the client's selection state.
   * Use JsSelection.saveBincode() to get the bytes.
   * @param data - Bincode-encoded A1Selection bytes
   */
  setA1Selection(data: Uint8Array) {
    if (!this.initialized || !this.renderer) return;
    this.renderer.set_a1_selection(data);
  }

  // Pending viewport buffer to be set after initialization
  private pendingViewportBuffer?: SharedArrayBuffer;

  /**
   * Set the viewport buffer (SharedArrayBuffer) for main thread control.
   */
  setViewportBuffer(buffer: SharedArrayBuffer) {
    if (!this.initialized || !this.renderer) {
      // Buffer arrived before initialization, queue it
      console.log('[rustRendererWasm] Queueing viewport buffer - not yet initialized');
      this.pendingViewportBuffer = buffer;
      return;
    }
    console.log('[rustRendererWasm] Setting viewport buffer');
    this.renderer.set_viewport_buffer(buffer);
  }

  /**
   * Check if the renderer is using the shared viewport buffer.
   */
  isUsingSharedViewport(): boolean {
    if (!this.initialized || !this.renderer) return false;
    return this.renderer.is_using_shared_viewport();
  }

  /**
   * Mark the viewport as dirty (forces a render next frame).
   */
  setViewportDirty() {
    if (!this.initialized || !this.renderer) return;
    this.renderer.set_viewport_dirty();
  }

  /**
   * Check if the renderer needs to render.
   */
  isDirty(): boolean {
    if (!this.initialized || !this.renderer) return false;
    return this.renderer.is_dirty();
  }

  /**
   * Check if meta fills have been loaded.
   */
  fillsMetaLoaded(): boolean {
    if (!this.initialized || !this.renderer) return false;
    return this.renderer.fills_meta_loaded();
  }

  /**
   * Get fill hashes that need to be loaded (visible but not loaded).
   * Returns a flat Int32Array of [hash_x, hash_y, hash_x, hash_y, ...]
   */
  getNeededFillHashes(): Int32Array | null {
    if (!this.initialized || !this.renderer) return null;
    try {
      const hashes = this.renderer.get_needed_fill_hashes();
      if (hashes.length === 0) return null;
      // Convert Box<[i32]> to Int32Array
      return new Int32Array(hashes);
    } catch (e) {
      console.warn('[rustRendererWasm] Error getting needed fill hashes:', e);
      return null;
    }
  }

  get isInitialized(): boolean {
    return this.initialized;
  }

  get renderBackend(): 'webgpu' | 'webgl' | undefined {
    return this.backend;
  }

  get rendererInstance(): WorkerRenderer | undefined {
    return this.renderer;
  }
}

export const rustRendererWasm = new RustRendererWasm();
