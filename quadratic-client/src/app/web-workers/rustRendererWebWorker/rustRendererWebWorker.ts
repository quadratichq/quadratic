/**
 * Interface between main thread and Rust Renderer web worker.
 *
 * This provides a TypeScript API for controlling the Rust-based WebGPU/WebGL
 * renderer running in a separate worker thread.
 */

import { debugFlag, debugFlagWait } from '@/app/debugFlags/debugFlags';
import initRustClient, {
  createViewportBuffer,
  ViewportBufferWriter,
} from '@/app/quadratic-rust-client/quadratic_rust_client';
import type {
  ClientRustRendererMessage,
  ClientRustRendererPing,
  RustRendererClientMessage,
} from './rustRendererClientMessages';

// Track WASM initialization
let rustClientInitialized = false;
let rustClientInitPromise: Promise<void> | null = null;

async function ensureRustClientInitialized(): Promise<void> {
  if (rustClientInitialized) return;
  if (rustClientInitPromise) return rustClientInitPromise;

  rustClientInitPromise = (async () => {
    await initRustClient();
    rustClientInitialized = true;
    console.log('[rustRendererWebWorker] quadratic-rust-client WASM initialized');
  })();

  return rustClientInitPromise;
}

class RustRendererWebWorker {
  private worker?: Worker;
  private id = 0;
  private waitingForResponse: Record<number, Function> = {};
  private canvas?: HTMLCanvasElement;
  private offscreenCanvas?: OffscreenCanvas;
  private isReady = false;
  private backend?: 'webgpu' | 'webgl';

  // WASM ViewportBufferWriter for viewport state (main thread writes, renderer reads)
  // Note: This can be set externally via setViewportBuffer() from ViewportControls
  private viewportBuffer?: ViewportBufferWriter;
  private viewportSharedBuffer?: SharedArrayBuffer;
  private externalViewportBuffer = false;

  // Queue messages until the worker is ready
  private messageQueue: ClientRustRendererMessage[] = [];

  // FPS tracking via SharedArrayBuffer (worker writes, main thread reads)
  private fpsBuffer?: SharedArrayBuffer;
  private fpsView?: Int32Array;
  private lastFrameCount = 0;

  /**
   * Initialize the worker (call early, before init())
   */
  initWorker() {
    this.worker = new Worker(new URL('./worker/rustRenderer.worker.ts', import.meta.url), { type: 'module' });
    this.worker.onmessage = this.handleMessage;
    this.worker.onerror = (e) => console.warn(`[rustRenderer.worker] error: ${e.message}`, e);
  }

  /**
   * Initialize the renderer with a canvas and core message port.
   * The canvas is transferred to the worker as an OffscreenCanvas.
   */
  async init(canvas: HTMLCanvasElement, coreMessagePort: MessagePort): Promise<void> {
    if (!this.worker) {
      throw new Error('Expected worker to be initialized in rustRendererWebWorker.init');
    }

    this.canvas = canvas;

    // Set canvas dimensions BEFORE transfer to avoid 300x150 default
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;

    this.offscreenCanvas = canvas.transferControlToOffscreen();

    const message: ClientRustRendererMessage = {
      type: 'clientRustRendererInit',
      canvas: this.offscreenCanvas,
      corePort: coreMessagePort,
      devicePixelRatio: window.devicePixelRatio || 1,
    };

    // Transfer both the canvas and the message port
    this.worker.postMessage(message, [this.offscreenCanvas, coreMessagePort]);

    if (await debugFlagWait('debugWebWorkers')) {
      console.log('[rustRendererWebWorker] initialized.');
    }
  }

  private handleMessage = async (e: MessageEvent<RustRendererClientMessage>) => {
    if (debugFlag('debugWebWorkersMessages')) {
      console.log(`[rustRendererWebWorker] message: ${e.data.type}`);
    }

    switch (e.data.type) {
      case 'rustRendererClientReady':
        this.isReady = true;
        this.backend = e.data.backend;
        console.log(`[rustRendererWebWorker] ready with ${e.data.backend} backend`);

        // Create and send the viewport buffer
        this.initViewportBuffer();

        // Create and send the FPS buffer
        this.initFPSBuffer();

        // Flush queued messages
        this.messageQueue.forEach((msg) => this.send(msg));
        this.messageQueue = [];
        return;

      case 'rustRendererClientError':
        console.error(`[rustRendererWebWorker] error: ${e.data.error}`, e.data.fatal ? '(fatal)' : '');
        return;

      case 'rustRendererClientPong':
        console.log(`[rustRendererWebWorker] pong: ${e.data.roundTripMs}ms round-trip`);
        return;

      case 'rustRendererClientCellClick':
        // TODO: Forward to appropriate handler
        console.log(`[rustRendererWebWorker] cell click: ${e.data.sheetId} (${e.data.x}, ${e.data.y})`);
        return;

      case 'rustRendererClientCellHover':
        // TODO: Forward to appropriate handler
        return;

      case 'rustRendererClientCellEdit':
        // TODO: Forward to appropriate handler (open cell editor)
        console.log(`[rustRendererWebWorker] cell edit: ${e.data.sheetId} (${e.data.x}, ${e.data.y})`);
        return;

      case 'rustRendererClientSelectionChanged':
        // TODO: Forward to selection handler
        return;

      case 'rustRendererClientScreenshot':
        // Handle screenshot response
        const callback = this.waitingForResponse[e.data.id];
        if (callback) {
          callback(e.data);
          delete this.waitingForResponse[e.data.id];
        }
        return;

      // Note: Meta fills are now requested directly from WASM to core via bincode messages
    }
  };

  private send(message: ClientRustRendererMessage, transferables?: Transferable[]) {
    if (!this.worker) {
      throw new Error('Expected worker to be initialized in rustRendererWebWorker.send');
    }

    // Queue messages if not ready yet
    if (!this.isReady && message.type !== 'clientRustRendererInit') {
      this.messageQueue.push(message);
      return;
    }

    if (transferables) {
      this.worker.postMessage(message, transferables);
    } else {
      this.worker.postMessage(message);
    }
  }

  /**
   * Initialize and send the viewport SharedArrayBuffer to the worker.
   * This enables zero-copy viewport sync between main thread and renderer.
   *
   * If an external buffer was set via setViewportBuffer(), that will be used instead.
   */
  private async initViewportBuffer() {
    // If external buffer was already set, just send it to the worker
    if (this.externalViewportBuffer && this.viewportSharedBuffer) {
      console.log('[rustRendererWebWorker] Using external viewport buffer');
      this.send({
        type: 'clientRustRendererViewportBuffer',
        buffer: this.viewportSharedBuffer,
      });
      console.log('[rustRendererWebWorker] External viewport buffer sent to worker');
      return;
    }

    // Check if SharedArrayBuffer is available
    if (typeof SharedArrayBuffer === 'undefined') {
      console.warn('[rustRendererWebWorker] SharedArrayBuffer not available (missing COOP/COEP headers)');
      return;
    }

    try {
      // Ensure WASM is initialized before using its functions
      await ensureRustClientInitialized();

      // Create the SharedArrayBuffer using WASM helper
      this.viewportSharedBuffer = createViewportBuffer();
      this.viewportBuffer = new ViewportBufferWriter(this.viewportSharedBuffer);

      // Initialize with canvas-specific values
      const dpr = window.devicePixelRatio || 1;
      const canvasWidth = this.canvas?.clientWidth ?? 800;
      const canvasHeight = this.canvas?.clientHeight ?? 600;

      this.viewportBuffer.writeAll(
        0, // positionX
        0, // positionY
        1, // scale
        dpr,
        canvasWidth * dpr, // width in device pixels
        canvasHeight * dpr, // height in device pixels
        true, // dirty
        '' // sheetId (will be set when sheet is selected)
      );

      console.log(`[rustRendererWebWorker] Viewport buffer created: ${canvasWidth}x${canvasHeight}, dpr=${dpr}`);

      // Send to worker
      this.send({
        type: 'clientRustRendererViewportBuffer',
        buffer: this.viewportSharedBuffer,
      });

      console.log('[rustRendererWebWorker] Viewport buffer sent to worker');
    } catch (e) {
      // SharedArrayBuffer may not be available (requires COOP/COEP headers)
      console.warn('[rustRendererWebWorker] Failed to create SharedArrayBuffer:', e);
    }
  }

  /**
   * Initialize and send the FPS SharedArrayBuffer to the worker.
   * Worker writes FPS and frame counter, main thread reads it.
   * Buffer layout: [fps: i32, frameCount: i32]
   */
  private initFPSBuffer() {
    if (typeof SharedArrayBuffer === 'undefined') {
      console.warn('[rustRendererWebWorker] SharedArrayBuffer not available for FPS');
      return;
    }

    try {
      // 8 bytes: 4 for FPS, 4 for rendering flag
      this.fpsBuffer = new SharedArrayBuffer(8);
      this.fpsView = new Int32Array(this.fpsBuffer);

      this.send({
        type: 'clientRustRendererFPSBuffer',
        buffer: this.fpsBuffer,
      });

      console.log('[rustRendererWebWorker] FPS buffer sent to worker');
    } catch (e) {
      console.warn('[rustRendererWebWorker] Failed to create FPS SharedArrayBuffer:', e);
    }
  }

  /**
   * Set an external viewport buffer (from ViewportControls).
   * This allows ViewportControls to manage the buffer and share it with the worker.
   * Call this before the worker is ready, or it will be sent immediately.
   */
  setExternalViewportBuffer(buffer: SharedArrayBuffer) {
    this.viewportSharedBuffer = buffer;
    this.externalViewportBuffer = true;

    // If worker is already ready, send it immediately
    if (this.isReady) {
      console.log('[rustRendererWebWorker] Sending external viewport buffer to worker');
      this.send({
        type: 'clientRustRendererViewportBuffer',
        buffer: this.viewportSharedBuffer,
      });
    }
  }

  /**
   * Write viewport state to the SharedArrayBuffer using WASM ping-pong buffering.
   * Call this whenever the viewport changes.
   * @param x - World X coordinate of the top-left corner
   * @param y - World Y coordinate of the top-left corner
   * @param scale - Zoom scale (1.0 = 100%)
   * @param width - Canvas width in CSS pixels
   * @param height - Canvas height in CSS pixels
   * @param sheetId - Current sheet ID (36-character UUID string)
   */
  writeViewport(x: number, y: number, scale: number, width: number, height: number, sheetId: string) {
    if (!this.viewportBuffer) return;

    const dpr = window.devicePixelRatio || 1;
    this.viewportBuffer.writeAll(
      x,
      y,
      scale,
      dpr,
      width * dpr,
      height * dpr,
      true, // dirty
      sheetId
    );
  }

  /**
   * Check if viewport buffer is available
   */
  get hasViewportBuffer(): boolean {
    return !!this.viewportBuffer;
  }

  // Track last logged values to avoid spam
  private lastLoggedViewport = { x: 0, y: 0, scale: 0 };

  /**
   * Update the viewport (visible area).
   * If SharedArrayBuffer is available, writes directly to it.
   * Also sends a message for fallback/legacy support.
   */
  updateViewport(sheetId: string, bounds: { x: number; y: number; width: number; height: number }, scale: number) {
    // Don't do anything if worker isn't initialized yet
    if (!this.worker) return;

    // Write to SharedArrayBuffer if available (zero-copy sync)
    // Note: bounds.x/y are world coordinates (top-left of visible area)
    // Canvas dimensions come from the actual canvas, not bounds
    if (this.canvas) {
      const canvasWidth = this.canvas.clientWidth || this.canvas.width;
      const canvasHeight = this.canvas.clientHeight || this.canvas.height;

      // Debug: log significant viewport changes (only if ready)
      if (this.isReady) {
        const diffX = Math.abs(bounds.x - this.lastLoggedViewport.x);
        const diffY = Math.abs(bounds.y - this.lastLoggedViewport.y);
        const diffScale = Math.abs(scale - this.lastLoggedViewport.scale);
        if (diffX > 10 || diffY > 10 || diffScale > 0.1) {
          this.lastLoggedViewport = { x: bounds.x, y: bounds.y, scale };
        }
      }

      this.writeViewport(bounds.x, bounds.y, scale, canvasWidth, canvasHeight, sheetId);
    }

    // Also send message for fallback
    this.send({
      type: 'clientRustRendererViewport',
      sheetId,
      bounds: bounds as any, // Rectangle type
      scale,
    });
  }

  /**
   * Switch to a different sheet
   */
  setSheet(sheetId: string) {
    this.send({ type: 'clientRustRendererSetSheet', sheetId });
  }

  /**
   * Handle canvas resize
   */
  resize(width: number, height: number) {
    this.send({
      type: 'clientRustRendererResize',
      width,
      height,
      devicePixelRatio: window.devicePixelRatio || 1,
    });
  }

  /**
   * Request a screenshot (for thumbnails)
   */
  screenshot(): Promise<{ imageData: Uint8Array; width: number; height: number }> {
    const id = this.id++;
    return new Promise((resolve) => {
      this.waitingForResponse[id] = (response: { imageData: Uint8Array; width: number; height: number }) => {
        resolve(response);
      };
      this.send({ type: 'clientRustRendererScreenshot', id });
    });
  }

  /**
   * Ping the worker (for testing/debugging)
   */
  ping() {
    const message: ClientRustRendererPing = {
      type: 'clientRustRendererPing',
      timestamp: performance.now(),
    };
    this.send(message);
  }

  /**
   * Check if the renderer is ready
   */
  get ready(): boolean {
    return this.isReady;
  }

  /**
   * Get the rendering backend being used
   */
  get renderBackend(): 'webgpu' | 'webgl' | undefined {
    return this.backend;
  }

  /**
   * Get the current FPS of the Rust renderer (read from SharedArrayBuffer)
   */
  get fps(): number {
    if (!this.fpsView) return 0;
    return Atomics.load(this.fpsView, 0);
  }

  /**
   * Check if the Rust renderer is rendering (frame counter changed since last check)
   */
  get isRendering(): boolean {
    if (!this.fpsView) return false;
    const currentFrameCount = Atomics.load(this.fpsView, 1);
    const isRendering = currentFrameCount !== this.lastFrameCount;
    this.lastFrameCount = currentFrameCount;
    return isRendering;
  }

  /**
   * Clean up WASM resources
   */
  dispose() {
    if (this.viewportBuffer) {
      this.viewportBuffer.free();
      this.viewportBuffer = undefined;
    }
    this.viewportSharedBuffer = undefined;
  }
}

export const rustRendererWebWorker = new RustRendererWebWorker();
