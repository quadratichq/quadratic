/**
 * RustRendererWasm handles the WASM module and its initialization.
 *
 * This provides a TypeScript interface to the Rust renderer compiled to WASM.
 * It manages the lifecycle of the WASM module and provides methods to interact
 * with the renderer.
 *
 * Font loading happens in parallel with WASM initialization to minimize startup time.
 * While WASM is compiling/initializing, fonts are being fetched from the server.
 */

import init, { WorkerRenderer, WorkerRendererGPU } from '@/app/quadratic-rust-renderer/quadratic_rust_renderer';
import type { FontLoadResult } from './rustRendererFontLoader';
import { startFontLoading } from './rustRendererFontLoader';

// Union type for renderer (WebGL or WebGPU)
type Renderer = WorkerRenderer | WorkerRendererGPU;

class RustRendererWasm {
  private canvas?: OffscreenCanvas;
  private devicePixelRatio = 1;
  private initialized = false;
  private backend?: 'webgpu' | 'webgl';
  private renderer?: Renderer;

  /**
   * Initialize the WASM renderer with an OffscreenCanvas.
   * Font loading happens in parallel with WASM initialization.
   * Returns the backend type being used (webgpu or webgl).
   */
  async init(canvas: OffscreenCanvas, devicePixelRatio: number): Promise<'webgpu' | 'webgl'> {
    this.canvas = canvas;
    this.devicePixelRatio = devicePixelRatio;

    // Start font loading in parallel with WASM initialization
    // This is a key optimization - while WASM is compiling, fonts are being fetched
    const fontLoadPromise = startFontLoading();

    // Initialize WASM module (init_wasm() is auto-called via #[wasm_bindgen(start)])
    await init();

    // Try WebGPU first, fall back to WebGL
    let renderer: Renderer;
    if (WorkerRendererGPU.is_available()) {
      try {
        renderer = await WorkerRendererGPU.new(canvas);
        this.backend = 'webgpu';
        console.log('[rustRendererWasm] Using WebGPU backend');
      } catch (error) {
        console.warn('[rustRendererWasm] WebGPU initialization failed, falling back to WebGL:', error);
        renderer = WorkerRenderer.new(canvas);
        this.backend = 'webgl';
        console.log('[rustRendererWasm] Using WebGL backend');
      }
    } else {
      renderer = WorkerRenderer.new(canvas);
      this.backend = 'webgl';
      console.log('[rustRendererWasm] Using WebGL backend (WebGPU not available)');
    }

    this.renderer = renderer;

    // Set up initial state
    renderer.set_headings_dpr(devicePixelRatio);

    // Set initial size from canvas (which may have been resized by CSS)
    const width = canvas.width / devicePixelRatio;
    const height = canvas.height / devicePixelRatio;
    if (width > 0 && height > 0) {
      renderer.resize(width, height);
      console.log(`[rustRendererWasm] Initial size: ${width}x${height}`);
    }

    // Wait for fonts to finish loading and pass them to the renderer
    const fontLoadResult = await fontLoadPromise;
    this.loadFontsIntoRenderer(renderer, fontLoadResult);

    renderer.start();

    this.initialized = true;

    console.log(`[rustRendererWasm] Fonts loaded: ${renderer.has_fonts()}`);

    return this.backend;
  }

  /**
   * Load pre-fetched fonts into the renderer.
   */
  private loadFontsIntoRenderer(renderer: Renderer, fontLoadResult: FontLoadResult): void {
    for (const font of fontLoadResult.fonts) {
      // Parse the .fnt file and add font metadata to the renderer
      try {
        renderer.load_font_from_fnt(font.fontName, font.fntContent, font.textureUidBase);
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
   */
  handleCoreMessage(data: Uint8Array) {
    if (!this.initialized || !this.renderer) {
      console.warn('[rustRendererWasm] Received core message before initialization');
      return;
    }

    // TODO: Implement handle_core_message in Rust
    // this.renderer.handle_core_message(data);
    console.log(`[rustRendererWasm] handleCoreMessage: ${data.length} bytes (not yet implemented)`);
  }

  /**
   * Send the Ready message to core.
   * This will be called once WASM is initialized and ready.
   */
  sendReadyToCore() {
    // TODO: This will be implemented when bincode message handling is ready.
    // The WASM code will serialize a RendererToCore::Ready message
    // and it will be sent via rustRendererCore.sendToCore(bincodeBytes).
    console.log('[rustRendererWasm] sendReadyToCore (not yet implemented)');
  }

  /**
   * Update the viewport (visible area and scale).
   */
  updateViewport(sheetId: string, bounds: { x: number; y: number; width: number; height: number }, scale: number) {
    if (!this.initialized || !this.renderer) return;

    this.renderer.set_viewport(bounds.x, bounds.y, scale);
    this.renderer.resize(bounds.width, bounds.height);
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
   * Handle a mouse event.
   */
  mouseEvent(
    eventType: 'move' | 'down' | 'up' | 'wheel',
    x: number,
    y: number,
    options?: {
      button?: number;
      deltaX?: number;
      deltaY?: number;
      modifiers?: { shift: boolean; ctrl: boolean; alt: boolean; meta: boolean };
    }
  ) {
    if (!this.initialized || !this.renderer) return;

    switch (eventType) {
      case 'down':
        this.renderer.on_drag_start();
        break;
      case 'move':
        this.renderer.on_drag_move(performance.now());
        break;
      case 'up':
        this.renderer.on_drag_end(performance.now());
        break;
      case 'wheel':
        this.renderer.on_wheel_event();
        if (options?.deltaY !== undefined) {
          // Handle zoom on wheel
          const zoomFactor = options.deltaY > 0 ? 0.9 : 1.1;
          this.renderer.zoom(zoomFactor, x, y);
        }
        break;
    }
  }

  /**
   * Handle a keyboard event.
   */
  keyEvent(
    eventType: 'down' | 'up',
    key: string,
    code: string,
    modifiers?: { shift: boolean; ctrl: boolean; alt: boolean; meta: boolean }
  ) {
    if (!this.initialized || !this.renderer) return;

    // TODO: Implement keyboard handling in Rust
    // this.renderer.key_event(eventType, key, code, modifiers);
  }

  /**
   * Resize the canvas.
   */
  resize(width: number, height: number, devicePixelRatio: number) {
    if (!this.initialized || !this.canvas || !this.renderer) return;

    this.devicePixelRatio = devicePixelRatio;
    this.canvas.width = width * devicePixelRatio;
    this.canvas.height = height * devicePixelRatio;

    this.renderer.resize(width, height);
    this.renderer.set_headings_dpr(devicePixelRatio);
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

  /**
   * Render a frame.
   * @param elapsed Time since last frame in milliseconds
   * @returns true if a render occurred
   */
  frame(elapsed: number): boolean {
    if (!this.initialized || !this.renderer) return false;
    return this.renderer.frame(elapsed);
  }

  /**
   * Pan the viewport.
   */
  pan(dx: number, dy: number) {
    if (!this.initialized || !this.renderer) return;
    this.renderer.pan(dx, dy);
  }

  /**
   * Zoom the viewport.
   */
  zoom(factor: number, centerX: number, centerY: number) {
    if (!this.initialized || !this.renderer) return;
    this.renderer.zoom(factor, centerX, centerY);
  }

  /**
   * Set the cursor position.
   */
  setCursor(col: bigint, row: bigint) {
    if (!this.initialized || !this.renderer) return;
    this.renderer.set_cursor(col, row);
  }

  /**
   * Set the cursor selection range.
   */
  setCursorSelection(startCol: bigint, startRow: bigint, endCol: bigint, endRow: bigint) {
    if (!this.initialized || !this.renderer) return;
    this.renderer.set_cursor_selection(startCol, startRow, endCol, endRow);
  }

  /**
   * Update deceleration (call each frame).
   * @param elapsed Time since last frame in milliseconds
   * @returns true if the viewport was moved
   */
  updateDecelerate(elapsed: number): boolean {
    if (!this.initialized || !this.renderer) return false;
    return this.renderer.update_decelerate(elapsed);
  }

  /**
   * Check if deceleration is active.
   */
  isDecelerating(): boolean {
    if (!this.initialized || !this.renderer) return false;
    return this.renderer.is_decelerating();
  }

  get isInitialized(): boolean {
    return this.initialized;
  }

  get renderBackend(): 'webgpu' | 'webgl' | undefined {
    return this.backend;
  }

  get rendererInstance(): Renderer | undefined {
    return this.renderer;
  }
}

export const rustRendererWasm = new RustRendererWasm();
